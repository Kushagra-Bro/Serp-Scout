/**
 * Read-only verification for the automatic ranking sweep.
 *
 *   tsx scripts/verify-auto-ranking.ts
 *
 * Prints what the rank-freshness reconciler would queue and why (dry run, no
 * writes), the current ranking coverage per business, the metric-card values,
 * and any queued/failed rank-sweep jobs left in Redis.
 */
import { runRankFreshnessReconciliation } from '../src/jobs/rank-freshness.js';
import { researchQueue } from '../src/jobs/queues.js';
import { db, businesses, keywords, rankingObservations, searchRuns, workspaces } from '../src/db/index.js';
import { getRankingsForBusiness } from '../src/services/ranking.service.js';
import { eq, inArray, sql } from 'drizzle-orm';

console.log('=== 1. rank-freshness reconciler (dry run: decides, enqueues nothing) ===');
const dry = await runRankFreshnessReconciliation({ dryRun: true });
for (const d of dry.decisions) {
  console.log(
    `  ${d.businessName.trim().padEnd(24)} action=${d.action.padEnd(18)} keywords=${String(d.monitoredKeywords).padStart(3)} ` +
      `unchecked=${String(d.uncheckedKeywords).padStart(3)} oldestCheck=${d.oldestCheckAgeHours ?? '-'}h  reason="${d.reason}"`
  );
}

console.log('\n=== 2. coverage + metric cards (same arithmetic as the Keywords page) ===');
for (const biz of await db.select().from(businesses)) {
  const kws = await db
    .select({ id: keywords.id, phrase: keywords.phrase })
    .from(keywords)
    .where(eq(keywords.businessId, biz.id));
  const ws = (await db.select().from(workspaces).where(eq(workspaces.id, biz.workspaceId)).limit(1))[0];

  if (!kws.length) {
    console.log(`  ${biz.name.trim().padEnd(24)} no keywords yet (awaiting discovery)   cadence=${ws?.refreshCadence}`);
    continue;
  }

  const phrases = new Set(kws.map((k) => k.phrase.trim().toLowerCase()));
  const checked = new Set(
    (await db.select({ query: searchRuns.query }).from(searchRuns).where(eq(searchRuns.businessId, biz.id)))
      .map((r) => r.query.trim().toLowerCase())
      .filter((q) => phrases.has(q))
  );
  const obs = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(rankingObservations)
    .where(inArray(rankingObservations.keywordId, kws.map((k) => k.id)));

  const rows = await getRankingsForBusiness(biz.id);
  const ranked = rows.filter((r) => r.currentRank !== null);
  const top3 = ranked.filter((r) => (r.currentRank || 99) <= 3).length;
  const top10 = ranked.filter((r) => (r.currentRank || 99) <= 10).length;
  const avg = ranked.length
    ? (ranked.reduce((a, r) => a + (r.currentRank || 0), 0) / ranked.length).toFixed(1)
    : '—';

  console.log(
    `  ${biz.name.trim().padEnd(24)} kw=${String(kws.length).padStart(3)} checked=${String(checked.size).padStart(3)} ` +
      `obs=${String(obs[0].n).padStart(4)} | cards Top3=${top3} Top10=${top10} Avg=${avg} | cadence=${ws?.refreshCadence}`
  );
}

console.log('\n=== 3. rank-sweep jobs in Redis ===');
const jobs = (await researchQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed'], 0, 40, true))
  .filter((j) => j.name === 'rank-sweep')
  .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  .slice(0, 8);
if (!jobs.length) console.log('  none queued or recorded');
for (const j of jobs) {
  const state = await j.getState();
  const outcome = j.returnvalue
    ? JSON.stringify(j.returnvalue).slice(0, 170)
    : j.failedReason
      ? `FAILED: ${String(j.failedReason).slice(0, 120)}`
      : '';
  console.log(
    `  ${new Date(j.timestamp).toISOString()} [${state}] biz=${String(j.data?.businessId || '').slice(0, 8)} ${outcome}`
  );
}

process.exit(0);
