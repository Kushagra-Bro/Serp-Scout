/**
 * Pure scheduling helpers — no DB, Redis, or BullMQ imports.
 *
 * Kept dependency-free so unit tests can exercise the cadence math without
 * opening live Postgres/Redis connections (which would keep the test runner's
 * event loop alive).
 */

export const CADENCE_CRON_PATTERNS: Record<string, string> = {
  daily: '0 6 * * *',      // Daily at 06:00 UTC
  weekly: '0 6 * * 1',     // Weekly every Monday at 06:00 UTC
  monthly: '0 6 1 * *',    // Monthly on the 1st at 06:00 UTC
};

/** First of the month at 00:05 UTC — clears every workspace meter. */
export const QUOTA_RESET_CRON = '5 0 1 * *';

/**
 * Computes the next scheduled research run time for a workspace cadence.
 *
 * Derived from the cadence alone (Postgres is the source of truth) instead of
 * a BullMQ repeatable's `next` field, so the schedule endpoint keeps returning
 * `nextRunAt` without reading Redis.
 */
export function computeNextCadenceRun(
  cadence: string | null | undefined,
  now: Date = new Date()
): Date | null {
  if (!cadence || cadence === 'manual' || !(cadence in CADENCE_CRON_PATTERNS)) {
    return null;
  }

  const next = new Date(now);

  if (cadence === 'daily') {
    next.setUTCHours(6, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  } else if (cadence === 'weekly') {
    next.setUTCHours(6, 0, 0, 0);
    const daysUntilMonday = (1 - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  } else if (cadence === 'monthly') {
    next.setUTCDate(1);
    next.setUTCHours(6, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setUTCMonth(next.getUTCMonth() + 1);
  }

  return next;
}

/**
 * Milliseconds until the next monthly quota reset (1st of the coming month at
 * 00:05 UTC). Used to arm the in-process timer; always lands at least 1s out so
 * a boot exactly on the boundary can never spin in a busy loop.
 */
export function nextQuotaResetDelayMs(now: Date = new Date()): number {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 5, 0, 0)
  );
  return Math.max(next.getTime() - now.getTime(), 1000);
}