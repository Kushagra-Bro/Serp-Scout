/**
 * Read-only: why the "Search Visibility & Ranking Shifts" table is empty, and
 * what data each business actually has to fill a detailed report.
 */
import {
  db,
  businesses,
  competitors,
  contentGaps,
  keywords,
  rankingObservations,
  recommendations,
  reports,
  reviewThemes,
  searchRuns,
  sourceEvidence,
} from '../src/db/index.js';
import { getRankingsForBusiness } from '../src/services/ranking.service.js';
import { eq, desc, inArray, sql } from 'drizzle-orm';

console.log('=== 1. latest stored report: what does the shift table contain? ===');
for (const report of await db.select().from(reports).orderBy(desc(reports.generatedAt)).limit(3)) {
  const summary: any = report.summary || {};
  const kc = summary?.visibilityChanges?.keywordChanges ?? [];
  const withBoth = kc.filter((k: any) => k.oldRank && k.newRank);
  const withAny = kc.filter((k: any) => k.oldRank || k.newRank);
  console.log(
    `  report ${report.id.slice(0, 8)} (${report.generatedAt?.toISOString().slice(0, 16)}) keywords=${kc.length} ` +
      `withOldAndNew=${withBoth.length} withAnyRank=${withAny.length}`
  );
  for (const k of kc.slice(0, 4)) {
    console.log(`      "${k.keyword?.slice(0, 46)}" old=${k.oldRank ?? '—'} new=${k.newRank ?? '—'}`);
  }
}

console.log('\n=== 2. per-business data availability (report material) ===');
const bizList = await db.select().from(businesses);
for (const biz of bizList) {
  const kws = await db.select({ id: keywords.id, phrase: keywords.phrase }).from(keywords).where(eq(keywords.businessId, biz.id));
  const kwIds = kws.map((k) => k.id);
  const comps = await db.select().from(competitors).where(eq(competitors.businessId, biz.id));
  const gaps = await db.select({ n: sql<number>`count(*)::int` }).from(contentGaps).where(eq(contentGaps.businessId, biz.id));
  const recs = await db.select({ n: sql<number>`count(*)::int` }).from(recommendations).where(eq(recommendations.businessId, biz.id));
  const evid = await db.select({ n: sql<number>`count(*)::int` }).from(sourceEvidence).where(eq(sourceEvidence.businessId, biz.id));
  const reps = await db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.businessId, biz.id));
  const themes = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviewThemes)
    .innerJoin(competitors, eq(reviewThemes.competitorId, competitors.id))
    .where(eq(competitors.businessId, biz.id));
  const runs = await db.select({ n: sql<number>`count(*)::int` }).from(searchRuns).where(eq(searchRuns.businessId, biz.id));

  const rows = await getRankingsForBusiness(biz.id);
  const ranked = rows.filter((r) => r.currentRank !== null);
  const withDelta = rows.filter((r) => r.delta !== null);
  const unranked = rows.length - ranked.length;

  console.log(
    `  ${biz.name.trim().padEnd(24)} kw=${String(kws.length).padStart(3)} ` +
      `ownRanked=${String(ranked.length).padStart(3)} unranked=${String(unranked).padStart(3)} withDelta=${String(withDelta.length).padStart(3)} | ` +
      `comps=${comps.length} gaps=${gaps[0].n} recs=${recs[0].n} evidence=${evid[0].n} reports=${reps[0].n} themes=${themes[0].n} runs=${runs[0].n}`
  );
}

console.log('\n=== 3. observation ownership mix (who the shift rows were describing) ===');
const clove = bizList.find((b) => b.name.includes('Clove')) || bizList[0];
const cloveKws = await db.select({ id: keywords.id, phrase: keywords.phrase }).from(keywords).where(eq(keywords.businessId, clove.id));
for (const kw of cloveKws.slice(0, 5)) {
  const obs = await db
    .select()
    .from(rankingObservations)
    .where(eq(rankingObservations.keywordId, kw.id))
    .orderBy(desc(rankingObservations.observedAt))
    .limit(2);
  console.log(
    `  "${kw.phrase.slice(0, 40).padEnd(40)}" newest-2 = ${obs.map((o) => `${o.domain}#${o.rank}`).join(', ') || 'none'}`
  );
}
console.log('  (report.worker used these two rows as current/previous regardless of domain)');
process.exit(0);
