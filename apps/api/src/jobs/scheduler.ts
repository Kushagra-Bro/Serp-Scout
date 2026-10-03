import { Queue } from 'bullmq';
import { researchQueue, redisConnection } from './queues.js';
import { CADENCE_CRON_PATTERNS } from '../lib/cadence.js';

/**
 * Removes any existing repeatable research jobs for a specific workspace.
 *
 * Matches on the exact workspaceId segment rather than a substring, so that
 * removing jobs for `ws-12` does not also remove jobs for `ws-1`.
 *
 * Note: the app no longer registers new repeatables (cadence is enforced by the
 * in-process reconciler reading Postgres), so this is a fail-safe cleanup for
 * anything left over from earlier versions.
 */
export async function removeWorkspaceRepeatableJobs(workspaceId: string): Promise<void> {
  const repeatableJobs = await researchQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    const key = job.key ?? '';
    // Repeatable job keys look like:
    //   bull:research-run:repeat:<workspaceId>:<businessId>:<patternHash>
    // Match the workspaceId as a delimited segment, not a raw substring.
    const segments = key.split(':');
    const matches = segments.includes(workspaceId) || job.id === `repeat-${workspaceId}`;

    if (matches) {
      console.log(`[Scheduler] Removing existing repeatable job: ${key}`);
      await researchQueue.removeRepeatableByKey(key);
    }
  }
}

/**
 * Records the intent to run recurring research for a workspace at `cadence`.
 *
 * Callers (the schedule route) are responsible for persisting `refreshCadence`
 * on the workspace in Postgres. No BullMQ repeatable is registered here: the
 * periodic catch-up reconciler (`runCatchUpReconciliation`, driven by an
 * in-process timer every 6h) reads `lastAnalyzedAt` + `refreshCadence` from
 * Postgres and enqueues overdue refreshes. Postgres is the source of truth and
 * the research-run queue stays drained between runs, which keeps the worker's
 * idle Redis polling down to ~1 request per drainDelay instead of every 10s.
 */
export async function scheduleWorkspaceResearch(params: {
  workspaceId: string;
  cadence: 'daily' | 'weekly' | 'monthly' | 'manual';
  businessId: string;
}): Promise<{ scheduled: boolean; pattern?: string }> {
  const { workspaceId, cadence } = params;

  if (cadence === 'manual') {
    console.log(`[Scheduler] Cadence set to manual for workspace ${workspaceId}. No recurring job registered.`);
    return { scheduled: false };
  }

  const pattern = CADENCE_CRON_PATTERNS[cadence] || CADENCE_CRON_PATTERNS.weekly;

  console.log(
    `[Scheduler] Cadence ${cadence} (${pattern}) for workspace ${workspaceId} will be enforced by the periodic reconciler.`
  );
  return { scheduled: true, pattern };
}

/**
 * Immediately enqueues an on-demand research & report run.
 */
export async function triggerImmediateRefresh(params: {
  workspaceId: string;
  businessId: string;
}) {
  const { workspaceId, businessId } = params;
  console.log(`[Scheduler] Triggering immediate research refresh for workspace ${workspaceId}, business ${businessId}...`);

  const job = await researchQueue.add(
    'manual-refresh',
    {
      workspaceId,
      businessId,
      triggerReport: true,
    },
    {
      priority: 1, // Higher priority for user-initiated refreshes
      // Deduplicate: repeated clicks within the same cadence window collapse
      // into a single job instead of enqueueing a pile of duplicates.
      deduplication: { id: `manual-refresh:${workspaceId}:${businessId}` },
    }
  );

  return {
    jobId: String(job.id),
    enqueuedAt: new Date().toISOString(),
  };
}

/**
 * Boot-time synchronization.
 *
 * Scheduling is now entirely in-process + DB-driven, so this no longer
 * registers repeatables. Instead it purges any repeatables left over from the
 * earlier BullMQ-based scheduler (both the research-run cadence repeats and the
 * `stale-check` queue's system repeats). Leftover repeats would not only fire
 * stale work, they would keep their queues perpetually "has future delayed
 * jobs", forcing the workers back to BullMQ's hard-coded 10-second block cap —
 * which is exactly the Redis churn budget this change removes.
 */
export async function syncAllWorkspaceSchedules(): Promise<void> {
  console.log('[Scheduler] Cleaning up legacy BullMQ repeatables (cadence is now in-process + DB-driven)...');
  try {
    let removed = 0;

    const researchRepeats = await researchQueue.getRepeatableJobs();
    for (const job of researchRepeats) {
      if (job.key) {
        await researchQueue.removeRepeatableByKey(job.key);
        removed++;
      }
    }

    // The stale-check queue is no longer exported; open a transient handle just
    // to sweep any left-over system repeats (stale-check/catch-up/quota-reset).
    const staleQueue = new Queue('stale-check', { connection: redisConnection });
    try {
      const staleRepeats = await staleQueue.getRepeatableJobs();
      for (const job of staleRepeats) {
        if (job.key) {
          await staleQueue.removeRepeatableByKey(job.key);
          removed++;
        }
      }
    } finally {
      await staleQueue.close();
    }

    if (removed > 0) {
      console.log(`[Scheduler] Removed ${removed} legacy repeatable job(s).`);
    }
  } catch (error) {
    console.error('[Scheduler] Legacy repeatable cleanup failed:', error);
  }
}