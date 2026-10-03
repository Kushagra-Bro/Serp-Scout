import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, businesses, workspaces } from '../../db/index.js';
import { redisConnection } from '../queues.js';
import { runCatchUpReconciliation } from '../catchup.js';
import { runQuotaReset } from '../quota-reset.js';

export interface StaleCheckJobData {
  workspaceId?: string;
  businessId?: string;
}

export interface StaleCheckResult {
  checkedCount: number;
  markedStaleCount: number;
  markedFreshCount: number;
}

/**
 * Checks businesses and flags `dataStale = true` if older than workspace staleDaysThreshold.
 */
export async function executeStaleCheck(data: StaleCheckJobData): Promise<StaleCheckResult> {
  console.log(`[StaleCheckWorker] Running stale data evaluation...`);

  // Query businesses with their parent workspace settings
  const query = db
    .select({
      businessId: businesses.id,
      businessName: businesses.name,
      lastAnalyzedAt: businesses.lastAnalyzedAt,
      currentDataStale: businesses.dataStale,
      staleDaysThreshold: workspaces.staleDaysThreshold,
      workspaceId: workspaces.id,
    })
    .from(businesses)
    .innerJoin(workspaces, eq(businesses.workspaceId, workspaces.id));

  const allBusinesses = await query;
  const filtered = allBusinesses.filter((b) => {
    if (data.businessId && b.businessId !== data.businessId) return false;
    if (data.workspaceId && b.workspaceId !== data.workspaceId) return false;
    return true;
  });

  let markedStaleCount = 0;
  let markedFreshCount = 0;
  const now = Date.now();

  for (const item of filtered) {
    const thresholdDays = item.staleDaysThreshold || 7;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    const isStale =
      !item.lastAnalyzedAt ||
      now - new Date(item.lastAnalyzedAt).getTime() > thresholdMs;

    if (isStale !== item.currentDataStale) {
      await db
        .update(businesses)
        .set({
          dataStale: isStale,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, item.businessId));

      if (isStale) {
        markedStaleCount++;
        console.log(`[StaleCheckWorker] Business "${item.businessName}" (${item.businessId}) marked STALE (threshold: ${thresholdDays} days).`);
      } else {
        markedFreshCount++;
        console.log(`[StaleCheckWorker] Business "${item.businessName}" (${item.businessId}) marked FRESH.`);
      }
    }
  }

  console.log(`[StaleCheckWorker] Evaluation complete. Checked ${filtered.length} businesses, ${markedStaleCount} marked stale, ${markedFreshCount} marked fresh.`);

  return {
    checkedCount: filtered.length,
    markedStaleCount,
    markedFreshCount,
  };
}

export function startStaleCheckWorker() {
  const worker = new Worker<StaleCheckJobData>(
    'stale-check',
    async (job: Job<StaleCheckJobData>) => {
      // Three concerns share this queue; dispatch by job name so the exported
      // executeStaleCheck contract stays untouched.
      if (job.name === 'recurring-catch-up') {
        return await runCatchUpReconciliation();
      }
      if (job.name === 'recurring-quota-reset') {
        return await runQuotaReset();
      }
      return await executeStaleCheck(job.data);
    },
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[StaleCheckWorker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[StaleCheckWorker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
