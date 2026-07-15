/**
 * Marker for in-process internal calls from the automation pipeline to the
 * article/image route handlers (invoked directly as functions, not over HTTP).
 *
 * The token is generated per process and never leaves it, so an external
 * request cannot forge the header: the pipeline and the route handlers share
 * this module instance, while any real HTTP request would need to guess a
 * random UUID that is not exposed anywhere.
 *
 * Used to skip the per-IP rate limiter for automation-originated generation:
 * those calls are already authenticated upstream via AUTOMATION_API_KEY and
 * throttled by the automation job queue (single-slot concurrency).
 */
export const INTERNAL_CALL_HEADER = "x-typereach-internal";

export const INTERNAL_CALL_TOKEN = crypto.randomUUID();

export function isInternalAutomationCall(req: Request): boolean {
  return req.headers.get(INTERNAL_CALL_HEADER) === INTERNAL_CALL_TOKEN;
}
