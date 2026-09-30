import { researchQueue, staleQueue, redisConnection } from './queues.js';
import { db, workspaces, businesses } from '../db/index.js';
import { eq } from 'drizzle-orm';

export const CADENCE_CRON_PATTERNS: Record<string, string> = {
  daily: '0 6 * * *',      // Daily at 06:00 UTC
  weekly: '0 6 * * 1',     // Weekly every Monday at 06:00 UTC
  monthly: '0 6 1 * *',    // Monthly on the 1st at 06:00 UTC
};

/**
 * Removes any existing repeatable research jobs for a specific workspace.
 */
export async function removeWorkspaceRepeatableJobs(workspaceId: string): Promise<void> {
  const repeatableJobs = await researchQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id?.includes(workspaceId) || job.key.includes(workspaceId)) {
      console.log(`[Scheduler] Removing existing repeatable job: ${job.key}`);
      await researchQueue.removeRepeatableByKey(job.key);
    }
  }
}

/**
 * Registers or updates a workspace's research schedule in BullMQ.
 */
export async function scheduleWorkspaceResearch(params: {
  workspaceId: string;
  cadence: 'daily' | 'weekly' | 'monthly' | 'manual';
  businessId: string;
}): Promise<{ scheduled: boolean; pattern?: string }> {
  const { workspaceId, cadence, businessId } = params;

  // Always clear previous schedule first
  await removeWorkspaceRepeatableJobs(workspaceId);

  if (cadence === 'manual') {
    console.log(`[Scheduler] Cadence set to manual for workspace ${workspaceId}. No recurring job registered.`);
    return { scheduled: false };
  }

  const pattern = CADENCE_CRON_PATTERNS[cadence] || CADENCE_CRON_PATTERNS.weekly;

  await researchQueue.add(
    'recurring-research',
    {
      workspaceId,
      businessId,
      triggerReport: true,
    },
    {
      repeat: {
        pattern,
      },
      jobId: `repeat-${workspaceId}-${businessId}`,
    }
  );

  console.log(`[Scheduler] Scheduled recurring research for workspace ${workspaceId} with cadence ${cadence} (${pattern}).`);
  return { scheduled: true, pattern };
}

/**
 * Registers the system-wide background stale data verification job.
 */
export async function scheduleStaleCheck(): Promise<void> {
  // Check if already registered
  const repeatableJobs = await staleQueue.getRepeatableJobs();
  const alreadyScheduled = repeatableJobs.some((j) => j.name === 'recurring-stale-check');

  if (!alreadyScheduled) {
    // Run every 6 hours
    await staleQueue.add(
      'recurring-stale-check',
      {},
      {
        repeat: {
          pattern: '0 */6 * * *',
        },
        jobId: 'system-stale-check',
      }
    );
    console.log('[Scheduler] Registered system-wide stale check job (every 6 hours).');
  }
}

/**
 * Registers the periodic catch-up reconciliation (every 6 hours, offset from
 * the stale check so they never contend on the same tick).
 *
 * The boot-time pass repairs an outage that just ended; this pass catches an
 * occurrence skipped by a deploy, a lost repeat job, or a Redis flush while the
 * process was otherwise up.
 */
export async function scheduleCatchUp(): Promise<void> {
  const repeatableJobs = await staleQueue.getRepeatableJobs();
  const alreadyScheduled = repeatableJobs.some((j) => j.name === 'recurring-catch-up');

  if (!alreadyScheduled) {
    await staleQueue.add(
      'recurring-catch-up',
      {},
      {
        repeat: {
          pattern: '15 */6 * * *',
        },
        jobId: 'system-catch-up',
      }
    );
    console.log('[Scheduler] Registered catch-up reconciliation job (every 6 hours).');
  }
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
    }
  );

  return {
    jobId: String(job.id),
    enqueuedAt: new Date().toISOString(),
  };
}

/**
 * Synchronizes all workspace schedules from Neon DB on server startup.
 */
export async function syncAllWorkspaceSchedules(): Promise<void> {
  console.log('[Scheduler] Synchronizing workspace recurring schedules...');

  try {
    await scheduleStaleCheck();
    await scheduleCatchUp();

    const allWorkspaces = await db.select().from(workspaces);
    for (const ws of allWorkspaces) {
      if (ws.refreshCadence && ws.refreshCadence !== 'manual') {
        const [primaryBiz] = await db
          .select()
          .from(businesses)
          .where(eq(businesses.workspaceId, ws.id))
          .limit(1);

        if (primaryBiz) {
          await scheduleWorkspaceResearch({
            workspaceId: ws.id,
            cadence: ws.refreshCadence as 'daily' | 'weekly' | 'monthly' | 'manual',
            businessId: primaryBiz.id,
          });
        }
      }
    }
    console.log(`[Scheduler] Synchronized schedules for ${allWorkspaces.length} workspaces.`);
  } catch (err) {
    console.error('[Scheduler] Schedule sync error:', err);
  }
}
