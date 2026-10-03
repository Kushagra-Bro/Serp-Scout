import { db, workspaces } from '../db/index.js';
import { staleQueue } from './queues.js';

/**
 * Monthly workspace quota reset.
 *
 * Workspace meters (`workspaces.usedQuota`) are described everywhere as monthly
 * ("wait for the next monthly cycle", plans with `monthlyQuota`), but nothing
 * ever reset them — once a workspace hit its cap, every paid refresh failed
 * forever. This module makes the month boundary real: a repeatable BullMQ job
 * runs on the 1st of each month and zeroes every workspace meter.
 *
 * Safe by construction: it only touches `used_quota`/`updated_at`, re-runs are
 * idempotent, and it never deletes rows.
 */
export async function runQuotaReset(now: Date = new Date()): Promise<{ resetCount: number }> {
  const updated = await db
    .update(workspaces)
    .set({
      usedQuota: 0,
      updatedAt: now,
    })
    .returning({ id: workspaces.id });

  if (updated.length > 0) {
    console.log(`[QuotaReset] Reset usedQuota → 0 for ${updated.length} workspace(s).`);
  } else {
    console.log('[QuotaReset] No workspaces to reset.');
  }

  return { resetCount: updated.length };
}

/** First of the month at 00:05 UTC — clears every workspace meter. */
export const QUOTA_RESET_CRON = '5 0 1 * *';

/**
 * Registers the monthly reset repeatable. Idempotent: a second call in the same
 * Redis simply skips re-registration.
 */
export async function scheduleQuotaReset(): Promise<void> {
  const repeatableJobs = await staleQueue.getRepeatableJobs();
  const alreadyScheduled = repeatableJobs.some((j) => j.name === 'recurring-quota-reset');

  if (!alreadyScheduled) {
    await staleQueue.add(
      'recurring-quota-reset',
      {},
      {
        repeat: { pattern: QUOTA_RESET_CRON },
        jobId: 'system-quota-reset',
        removeOnFail: 10,
      }
    );
    console.log('[Scheduler] Registered monthly quota reset job (1st of month at 00:05 UTC).');
  }
}