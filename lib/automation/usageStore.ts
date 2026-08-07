import { createHash } from "node:crypto";
import { kv } from "@vercel/kv";

type BudgetCode = "daily_budget_exceeded" | "monthly_budget_exceeded";

interface ReservationRecord {
  keyId: string;
  day: string;
  month: string;
  estimatedCostUsd: number;
}

export interface AutomationUsageSnapshot {
  spentTodayUsd: number;
  spentThisMonthUsd: number;
  reservedTodayUsd: number;
  reservedThisMonthUsd: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  dailyRemainingUsd: number;
  monthlyRemainingUsd: number;
  averageArticleCost7dUsd: number;
}

export type UsageReservationResult =
  | { ok: true }
  | { ok: false; code: BudgetCode; message: string };

const memoryValues = new Map<string, number>();
const memoryReservations = new Map<string, ReservationRecord>();
const DAY_TTL_SECONDS = 60 * 60 * 24 * 10;
const MONTH_TTL_SECONDS = 60 * 60 * 24 * 40;

function positiveEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function dailyCostLimitUsd(): number {
  return positiveEnv("DAILY_COST_LIMIT_USD", 5);
}

export function monthlyCostLimitUsd(): number {
  return positiveEnv("MONTHLY_COST_LIMIT_USD", 100);
}

export function automationApiKeyId(req: Request): string {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "unknown";
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

function isKvAvailable(): boolean {
  return !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
}

function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function utcMonth(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function spentDayKey(keyId: string, day: string): string {
  return `automation:usage:${keyId}:day:${day}:spent`;
}
function reservedDayKey(keyId: string, day: string): string {
  return `automation:usage:${keyId}:day:${day}:reserved`;
}
function countDayKey(keyId: string, day: string): string {
  return `automation:usage:${keyId}:day:${day}:count`;
}
function spentMonthKey(keyId: string, month: string): string {
  return `automation:usage:${keyId}:month:${month}:spent`;
}
function reservedMonthKey(keyId: string, month: string): string {
  return `automation:usage:${keyId}:month:${month}:reserved`;
}
function reservationKey(jobId: string): string {
  return `automation:usage:reservation:${jobId}`;
}

function numberValue(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function memoryIncrement(key: string, amount: number): void {
  memoryValues.set(key, Math.max(0, numberValue(memoryValues.get(key)) + amount));
}

export async function reserveAutomationUsage(
  keyId: string,
  jobId: string,
  estimatedCostUsd: number
): Promise<UsageReservationResult> {
  const day = utcDay();
  const month = utcMonth();
  const estimated = Number(Math.max(0, estimatedCostUsd).toFixed(6));
  const dailyLimit = dailyCostLimitUsd();
  const monthlyLimit = monthlyCostLimitUsd();
  const record: ReservationRecord = { keyId, day, month, estimatedCostUsd: estimated };

  if (isKvAvailable()) {
    const script = `
      local dayTotal = tonumber(redis.call('GET', KEYS[1]) or '0') + tonumber(redis.call('GET', KEYS[2]) or '0')
      local monthTotal = tonumber(redis.call('GET', KEYS[3]) or '0') + tonumber(redis.call('GET', KEYS[4]) or '0')
      local amount = tonumber(ARGV[1])
      if dayTotal + amount > tonumber(ARGV[2]) then return 'daily' end
      if monthTotal + amount > tonumber(ARGV[3]) then return 'monthly' end
      redis.call('INCRBYFLOAT', KEYS[2], amount)
      redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4]))
      redis.call('INCRBYFLOAT', KEYS[4], amount)
      redis.call('EXPIRE', KEYS[4], tonumber(ARGV[5]))
      redis.call('SET', KEYS[5], ARGV[6], 'EX', tonumber(ARGV[5]))
      return 'ok'
    `;
    const result = await kv.eval(
      script,
      [
        spentDayKey(keyId, day), reservedDayKey(keyId, day),
        spentMonthKey(keyId, month), reservedMonthKey(keyId, month),
        reservationKey(jobId),
      ],
      [estimated, dailyLimit, monthlyLimit, DAY_TTL_SECONDS, MONTH_TTL_SECONDS, JSON.stringify(record)]
    );
    if (result === "daily") {
      return { ok: false, code: "daily_budget_exceeded", message: `Daily automation budget of $${dailyLimit.toFixed(2)} is exhausted. No job was queued.` };
    }
    if (result === "monthly") {
      return { ok: false, code: "monthly_budget_exceeded", message: `Monthly automation budget of $${monthlyLimit.toFixed(2)} is exhausted. No job was queued.` };
    }
    return { ok: true };
  }

  const dayTotal = numberValue(memoryValues.get(spentDayKey(keyId, day))) + numberValue(memoryValues.get(reservedDayKey(keyId, day)));
  const monthTotal = numberValue(memoryValues.get(spentMonthKey(keyId, month))) + numberValue(memoryValues.get(reservedMonthKey(keyId, month)));
  if (dayTotal + estimated > dailyLimit) {
    return { ok: false, code: "daily_budget_exceeded", message: `Daily automation budget of $${dailyLimit.toFixed(2)} is exhausted. No job was queued.` };
  }
  if (monthTotal + estimated > monthlyLimit) {
    return { ok: false, code: "monthly_budget_exceeded", message: `Monthly automation budget of $${monthlyLimit.toFixed(2)} is exhausted. No job was queued.` };
  }
  memoryIncrement(reservedDayKey(keyId, day), estimated);
  memoryIncrement(reservedMonthKey(keyId, month), estimated);
  memoryReservations.set(jobId, record);
  return { ok: true };
}

export async function finalizeAutomationUsage(jobId: string, actualCostUsd: number): Promise<void> {
  let record: ReservationRecord | null = null;
  if (isKvAvailable()) {
    const raw = await kv.get<string | ReservationRecord>(reservationKey(jobId));
    if (!raw) return;
    record = typeof raw === "string" ? JSON.parse(raw) as ReservationRecord : raw;
    const script = `
      if redis.call('DEL', KEYS[1]) == 0 then return 0 end
      local reserved = tonumber(ARGV[1])
      local actual = tonumber(ARGV[2])
      redis.call('INCRBYFLOAT', KEYS[2], -reserved)
      redis.call('INCRBYFLOAT', KEYS[3], -reserved)
      redis.call('INCRBYFLOAT', KEYS[4], actual)
      redis.call('EXPIRE', KEYS[4], tonumber(ARGV[3]))
      redis.call('INCRBYFLOAT', KEYS[5], actual)
      redis.call('EXPIRE', KEYS[5], tonumber(ARGV[4]))
      redis.call('INCRBY', KEYS[6], 1)
      redis.call('EXPIRE', KEYS[6], tonumber(ARGV[3]))
      return 1
    `;
    await kv.eval(script, [
      reservationKey(jobId),
      reservedDayKey(record.keyId, record.day),
      reservedMonthKey(record.keyId, record.month),
      spentDayKey(record.keyId, record.day),
      spentMonthKey(record.keyId, record.month),
      countDayKey(record.keyId, record.day),
    ], [record.estimatedCostUsd, Math.max(0, actualCostUsd), DAY_TTL_SECONDS, MONTH_TTL_SECONDS]);
    return;
  }

  record = memoryReservations.get(jobId) || null;
  if (!record) return;
  memoryReservations.delete(jobId);
  memoryIncrement(reservedDayKey(record.keyId, record.day), -record.estimatedCostUsd);
  memoryIncrement(reservedMonthKey(record.keyId, record.month), -record.estimatedCostUsd);
  memoryIncrement(spentDayKey(record.keyId, record.day), actualCostUsd);
  memoryIncrement(spentMonthKey(record.keyId, record.month), actualCostUsd);
  memoryIncrement(countDayKey(record.keyId, record.day), 1);
}

export async function releaseAutomationUsageReservation(jobId: string): Promise<void> {
  await finalizeAutomationUsage(jobId, 0);
}

async function readNumber(key: string): Promise<number> {
  if (isKvAvailable()) return numberValue(await kv.get(key));
  return numberValue(memoryValues.get(key));
}

export async function getAutomationUsage(keyId: string): Promise<AutomationUsageSnapshot> {
  const day = utcDay();
  const month = utcMonth();
  const [spentToday, reservedToday, spentMonth, reservedMonth] = await Promise.all([
    readNumber(spentDayKey(keyId, day)),
    readNumber(reservedDayKey(keyId, day)),
    readNumber(spentMonthKey(keyId, month)),
    readNumber(reservedMonthKey(keyId, month)),
  ]);
  let sevenDayCost = 0;
  let sevenDayCount = 0;
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const dateKey = utcDay(date);
    sevenDayCost += await readNumber(spentDayKey(keyId, dateKey));
    sevenDayCount += await readNumber(countDayKey(keyId, dateKey));
  }
  const dailyLimit = dailyCostLimitUsd();
  const monthlyLimit = monthlyCostLimitUsd();
  return {
    spentTodayUsd: Number(spentToday.toFixed(6)),
    spentThisMonthUsd: Number(spentMonth.toFixed(6)),
    reservedTodayUsd: Number(reservedToday.toFixed(6)),
    reservedThisMonthUsd: Number(reservedMonth.toFixed(6)),
    dailyLimitUsd: dailyLimit,
    monthlyLimitUsd: monthlyLimit,
    dailyRemainingUsd: Number(Math.max(0, dailyLimit - spentToday - reservedToday).toFixed(6)),
    monthlyRemainingUsd: Number(Math.max(0, monthlyLimit - spentMonth - reservedMonth).toFixed(6)),
    averageArticleCost7dUsd: sevenDayCount > 0 ? Number((sevenDayCost / sevenDayCount).toFixed(6)) : 0,
  };
}
