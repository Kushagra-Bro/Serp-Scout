import { eq } from 'drizzle-orm';
import { db, businesses, workspaces } from '../db/index.js';

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
 *
 * Previously this lived in the BullMQ `stale-check` worker. It is now invoked
 * directly by the in-process system timer so no standing queue/worker has to
 * poll Redis, which protects the 500k/month Upstash request budget.
 */
export async function executeStaleCheck(data: StaleCheckJobData): Promise<StaleCheckResult> {
  console.log('[StaleCheck] Running stale data evaluation...');

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
        console.log(`[StaleCheck] Business "${item.businessName}" (${item.businessId}) marked STALE (threshold: ${thresholdDays} days).`);
      } else {
        markedFreshCount++;
        console.log(`[StaleCheck] Business "${item.businessName}" (${item.businessId}) marked FRESH.`);
      }
    }
  }

  console.log(`[StaleCheck] Evaluation complete. Checked ${filtered.length} businesses, ${markedStaleCount} marked stale, ${markedFreshCount} marked fresh.`);

  return {
    checkedCount: filtered.length,
    markedStaleCount,
    markedFreshCount,
  };
}