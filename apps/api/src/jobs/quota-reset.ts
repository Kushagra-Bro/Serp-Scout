import { db, workspaces } from '../db/index.js';

/**
 * Monthly workspace quota reset.
 *
 * Workspace meters (`workspaces.usedQuota`) are described everywhere as monthly
 * ("wait for the next monthly cycle", plans with `monthlyQuota`), but nothing
 * ever reset them — once a workspace hit its cap, every paid refresh failed
 * forever. This module makes the month boundary real: an in-process timer
 * (`startSystemTimers`) runs this on the 1st of each month and zeroes every
 * workspace meter. Previously this ran as a BullMQ repeatable; the timer keeps
 * the same semantics without the standing queue/worker that polled Redis.
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