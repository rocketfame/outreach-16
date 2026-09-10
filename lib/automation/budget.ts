import { AsyncLocalStorage } from "node:async_hooks";

interface CostReservation {
  id: string;
  step: string;
  estimatedCostUsd: number;
}

export interface AutomationBudgetSnapshot {
  jobId: string;
  capUsd: number;
  costUsd: number;
  reservedUsd: number;
  retriesUsed: number;
  maxRetries: number;
  steps: Array<{ step: string; costUsd: number }>;
}

interface AutomationBudgetContext {
  jobId: string;
  capUsd: number;
  costUsd: number;
  retriesUsed: number;
  maxRetries: number;
  reservations: Map<string, CostReservation>;
  steps: Array<{ step: string; costUsd: number }>;
}

const budgetStorage = new AsyncLocalStorage<AutomationBudgetContext>();

function positiveEnv(name: string, fallback: number, max: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

/**
 * Absolute per-job ceiling. A request's maxCostUsd can never exceed this.
 * Raised 1.0 → 2.0 on 2026-09-10: a 2 700-word human article on
 * Undetectable.AI is ~$1.35 humanization + ~$0.30 generation + cover, which
 * the old ceiling rejected at pre-flight.
 */
export const HARD_JOB_COST_CEILING_USD = 2.0;

export function maxJobCostUsd(): number {
  return positiveEnv("MAX_JOB_COST_USD", 0.4, HARD_JOB_COST_CEILING_USD);
}

/** Per-job cap: caller's maxCostUsd, clamped to the hard ceiling. */
export function resolveJobCostCapUsd(requestedCapUsd?: number): number {
  if (Number.isFinite(requestedCapUsd) && (requestedCapUsd as number) > 0) {
    return Math.min(requestedCapUsd as number, HARD_JOB_COST_CEILING_USD);
  }
  return maxJobCostUsd();
}

export function maxRetriesPerJob(): number {
  const parsed = Number(process.env.MAX_RETRIES_PER_JOB ?? "1");
  if (!Number.isFinite(parsed) || parsed < 0) return 1;
  return Math.min(Math.floor(parsed), 5);
}

function roundCost(value: number): number {
  return Number(Math.max(0, value).toFixed(6));
}

function reservedTotal(context: AutomationBudgetContext): number {
  return Array.from(context.reservations.values())
    .reduce((sum, reservation) => sum + reservation.estimatedCostUsd, 0);
}

export class AutomationCostCapError extends Error {
  readonly code = "cost_cap_exceeded";
  readonly costUsd: number;
  readonly step: string;

  constructor(context: AutomationBudgetContext, step: string, attemptedCostUsd: number) {
    const committed = context.costUsd + reservedTotal(context);
    super(
      `Job cost cap exceeded at ${step}: actual $${context.costUsd.toFixed(4)}, ` +
      `committed $${committed.toFixed(4)}, attempted $${attemptedCostUsd.toFixed(4)}, ` +
      `cap $${context.capUsd.toFixed(2)}.`
    );
    this.name = "AutomationCostCapError";
    this.costUsd = roundCost(context.costUsd);
    this.step = step;
  }
}

export class AutomationRetryLimitError extends Error {
  readonly code = "retry_budget_exceeded";
  readonly costUsd: number;

  constructor(context: AutomationBudgetContext, step: string) {
    super(
      `Retry blocked at ${step}: ${context.retriesUsed}/${context.maxRetries} retries used; ` +
      `actual cost $${context.costUsd.toFixed(4)} of $${context.capUsd.toFixed(2)} cap.`
    );
    this.name = "AutomationRetryLimitError";
    this.costUsd = roundCost(context.costUsd);
  }
}

export interface AutomationBudgetRunResult<T> {
  value?: T;
  error?: unknown;
  snapshot: AutomationBudgetSnapshot;
}

function snapshot(context: AutomationBudgetContext): AutomationBudgetSnapshot {
  return {
    jobId: context.jobId,
    capUsd: context.capUsd,
    costUsd: roundCost(context.costUsd),
    reservedUsd: roundCost(reservedTotal(context)),
    retriesUsed: context.retriesUsed,
    maxRetries: context.maxRetries,
    steps: [...context.steps],
  };
}

export async function runWithAutomationBudget<T>(
  jobId: string,
  operation: () => Promise<T>,
  options?: { capUsd?: number }
): Promise<AutomationBudgetRunResult<T>> {
  const context: AutomationBudgetContext = {
    jobId,
    capUsd: resolveJobCostCapUsd(options?.capUsd),
    costUsd: 0,
    retriesUsed: 0,
    maxRetries: maxRetriesPerJob(),
    reservations: new Map(),
    steps: [],
  };
  return budgetStorage.run(context, async () => {
    try {
      return { value: await operation(), snapshot: snapshot(context) };
    } catch (error) {
      return { error, snapshot: snapshot(context) };
    }
  });
}

export function reserveAutomationCost(step: string, estimatedCostUsd: number): string | null {
  const context = budgetStorage.getStore();
  if (!context) return null;
  const estimate = roundCost(estimatedCostUsd);
  if (context.costUsd + reservedTotal(context) + estimate > context.capUsd + 1e-9) {
    throw new AutomationCostCapError(context, step, estimate);
  }
  const id = `${step}:${crypto.randomUUID()}`;
  context.reservations.set(id, { id, step, estimatedCostUsd: estimate });
  return id;
}

export function cancelAutomationCostReservation(reservationId: string | null): void {
  if (!reservationId) return;
  budgetStorage.getStore()?.reservations.delete(reservationId);
}

export function settleAutomationCost(
  reservationId: string | null,
  step: string,
  actualCostUsd: number
): void {
  const context = budgetStorage.getStore();
  if (!context) return;
  if (reservationId) context.reservations.delete(reservationId);
  const actual = roundCost(actualCostUsd);
  context.costUsd = roundCost(context.costUsd + actual);
  context.steps.push({ step, costUsd: actual });
  if (context.costUsd > context.capUsd + 1e-9) {
    throw new AutomationCostCapError(context, step, actual);
  }
}

export function claimAutomationRetry(step: string, estimatedRetryCostUsd: number): void {
  const context = budgetStorage.getStore();
  if (!context) return;
  if (context.retriesUsed >= context.maxRetries) {
    throw new AutomationRetryLimitError(context, step);
  }
  const estimate = roundCost(estimatedRetryCostUsd);
  if (context.costUsd + reservedTotal(context) + estimate > context.capUsd + 1e-9) {
    throw new AutomationCostCapError(context, step, estimate);
  }
  context.retriesUsed += 1;
}

export function getAutomationBudgetSnapshot(): AutomationBudgetSnapshot | null {
  const context = budgetStorage.getStore();
  return context ? snapshot(context) : null;
}

export function rethrowAutomationBudgetError(error: unknown): void {
  if (
    error instanceof AutomationCostCapError ||
    error instanceof AutomationRetryLimitError
  ) {
    throw error;
  }
}
