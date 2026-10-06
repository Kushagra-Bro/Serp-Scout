/**
 * Read-only: explains the "Top 3 / Page 1 / Average Position" metric cards on
 * the Keyword & Ranking Monitoring page, and predicts what one "Refresh
 * Rankings" click would produce (no DB writes; Tavily is the free provider).
 */
import { db, businesses, competitors, keywords, searchRuns, rankingObservations } from '../src/db/index.js';
import { getRankingsForBusiness, extractDomainFromUrl } from '../src/services/ranking.service.js';
import { searchTavily } from '../src/services/tavily.service.js';
import { env } from '../src/config/env.js';
import { and, eq, inArray, desc } from 'drizzle-orm';

/** Exactly the arithmetic in keywords/page.tsx lines 416-422. */
function metrics(rows: Awaited<ReturnType<typeof getRankingsForBusiness>>) {
  const top3 = rows.filter((r) => r.currentRank !== null && r.currentRank <= 3).length;
  const top10 = rows.filter((r) => r.currentRank !== null && r.currentRank <= 10).length;
  const ranked = rows.filter((r) => r.currentRank !== null);
  const avg = ranked.length
    ? (ranked.reduce((a, r) => a + (r.currentRank || 0), 0) / ranked.length).toFixed(1)
    : '—';
  return { top3, top10, avg, rankedCount: ranked.length };
}

const bizList = await db.select().from(businesses).limit(50);

console.log('=== 1. metric cards exactly as the page computes them ===');
for (const biz of bizList) {
  const rows = await getRankingsForBusiness(biz.id);
  if (!rows.length) {
    console.log(`  ${biz.name.trim().padEnd(24)} no keywords -> cards show 0 / 0 / —`);
    continue;
  }
  const m = metrics(rows);
  const obs = await db
    .select({ n: rankingObservations.id })
    .from(rankingObservations)
    .innerJoin(keywords, eq(rankingObservations.keywordId, keywords.id))
    .where(eq(keywords.businessId, biz.id));
  console.log(
    `  ${biz.name.trim().padEnd(24)} keywords=${String(rows.length).padStart(3)} observations=${String(obs.length).padStart(4)} ` +
      `rankedKeywords=${m.rankedCount}  -> Top3=${m.top3} Top10=${m.top10} Avg=${m.avg}`
  );
}

// ── 2. The business that shows 0 / 0 / — ────────────────────────────────────
const target = bizList.find((b) => b.name.trim() === 'Body fitness gym')!;
const targetRows = await getRankingsForBusiness(target.id);
const targetObs = await db
  .select({ n: rankingObservations.id })
  .from(rankingObservations)
  .innerJoin(keywords, eq(rankingObservations.keywordId, keywords.id))
  .where(eq(keywords.businessId, target.id));
const kwRuns = await db
  .select({ query: searchRuns.query })
  .from(searchRuns)
  .where(and(eq(searchRuns.businessId, target.id), inArray(searchRuns.query, targetRows.map((r) => r.keyword.phrase))));

console.log(`\n=== 2. "${target.name.trim()}" — why every card is 0 / 0 / — ===`);
console.log(`  keywords returned by GET /keywords : ${targetRows.length}`);
console.log(`  rows with currentRank !== null     : ${targetRows.filter((r) => r.currentRank !== null).length}`);
console.log(`  ranking_observations rows          : ${targetObs.length}`);
console.log(`  search runs matching a keyword     : ${kwRuns.length}  (a sweep never ran for this business)`);
console.log(`  user domain checked                : ${extractDomainFromUrl(target.websiteUrl)}`);

// ── 3. Reported rank vs actual best rank (semantics check) ──────────────────
console.log('\n=== 3. what "Current Rank" picks when a keyword has several user ranks ===');
const clove = bizList.find((b) => b.name.includes('Clove'))!;
const cloveRows = await getRankingsForBusiness(clove.id);
const cloveKws = await db.select().from(keywords).where(eq(keywords.businessId, clove.id));
const userDomain = extractDomainFromUrl(clove.websiteUrl);
const cloveObs = await db
  .select()
  .from(rankingObservations)
  .where(inArray(rankingObservations.keywordId, cloveKws.map((k) => k.id)))
  .orderBy(desc(rankingObservations.observedAt));

let understated = 0;
const bestRankRows: typeof cloveRows = [];
for (const row of cloveRows) {
  const obs = cloveObs.filter(
    (o) => o.keywordId === row.keyword.id && (o.domain.includes(userDomain) || userDomain.includes(o.domain))
  );
  const best = obs.length ? Math.min(...obs.map((o) => o.rank)) : null;
  bestRankRows.push({ ...row, currentRank: best });
  if (obs.length > 1) understated++;
}
const reported = metrics(cloveRows);
const bestCase = metrics(bestRankRows);
console.log(`  keywords whose own domain was seen more than once: ${understated}`);
console.log(`  cards as computed today (latest check, best position) : Top3=${reported.top3} Top10=${reported.top10} Avg=${reported.avg}`);
console.log(`  cards if it took the all-time best rank              : Top3=${bestCase.top3} Top10=${bestCase.top10} Avg=${bestCase.avg}`);
console.log('  per-check detail (what a "check" now means):');
for (const row of cloveRows.filter((r) => r.currentRank !== null).slice(0, 3)) {
  const obs = cloveObs.filter(
    (o) => o.keywordId === row.keyword.id && (o.domain.includes(userDomain) || userDomain.includes(o.domain))
  );
  const byRun = new Map<string, { ranks: number[]; at: Date }>();
  for (const o of obs) {
    const key = o.searchRunId ?? `obs:${o.id}`;
    const g = byRun.get(key) ?? { ranks: [], at: new Date(o.observedAt) };
    g.ranks.push(o.rank);
    if (new Date(o.observedAt).getTime() > g.at.getTime()) g.at = new Date(o.observedAt);
    byRun.set(key, g);
  }
  const checks = [...byRun.entries()].sort((a, b) => b[1].at.getTime() - a[1].at.getTime());
  console.log(
    `   "${row.keyword.phrase.slice(0, 46).padEnd(46)}" reported #${row.currentRank} prev #${row.previousRank} delta=${row.delta}`
  );
  for (const [runId, g] of checks) {
    console.log(
      `        run ${runId.slice(0, 8)} @ ${g.at.toISOString()} ranks=[${g.ranks.sort((a, b) => a - b).join(',')}] -> check rank #${Math.min(...g.ranks)}`
    );
  }
}

// ── 4. Predict the next refresh pass for the gym (read-only, free provider) ──
console.log(`\n=== 4. what one "Refresh Rankings" click would now write for "${target.name.trim()}" ===`);
const eligible = targetRows.map((r) => r.keyword);
const runsForPhrases = await db
  .select({ query: searchRuns.query, requestedAt: searchRuns.requestedAt })
  .from(searchRuns)
  .where(and(eq(searchRuns.businessId, target.id), inArray(searchRuns.query, eligible.map((k) => k.phrase))));
const lastChecked = new Map<string, number>();
for (const r of runsForPhrases) {
  const key = r.query.trim().toLowerCase();
  const at = new Date(r.requestedAt).getTime();
  if (at > (lastChecked.get(key) ?? 0)) lastChecked.set(key, at);
}
const pass = [...eligible]
  .sort((a, b) => {
    const ac = lastChecked.get(a.phrase.trim().toLowerCase()) ?? 0;
    const bc = lastChecked.get(b.phrase.trim().toLowerCase()) ?? 0;
    if (ac !== bc) return ac - bc;
    return b.opportunityScore - a.opportunityScore;
  })
  .slice(0, 10);

const compDomains = new Set(
  (await db.select({ domain: competitors.domain }).from(competitors).where(eq(competitors.businessId, target.id))).map((c) =>
    c.domain.toLowerCase()
  )
);
const gymDomain = extractDomainFromUrl(target.websiteUrl);
const searchLocation = target.city || undefined;
let predictedUserRanks: number[] = [];
let predictedRivalHits = 0;
for (const kw of pass) {
  const location = kw.location || undefined;
  const loc = location || searchLocation;
  const q = loc && !kw.phrase.toLowerCase().includes(loc.toLowerCase()) ? `${kw.phrase} ${loc}` : kw.phrase;
  try {
    const res = await searchTavily({ query: q, apiKey: env.TAVILY_API_KEY!, num: 20 });
    const userRanks = res
      .filter((r) => r.domain.toLowerCase().includes(gymDomain) || gymDomain.includes(r.domain.toLowerCase()))
      .map((r) => r.rank);
    const rivals = res.filter((r) => compDomains.has(r.domain.toLowerCase()));
    predictedUserRanks.push(...userRanks);
    predictedRivalHits += rivals.length;
    if (userRanks.length || rivals.length) {
      console.log(
        `  "${kw.phrase.slice(0, 56).padEnd(56)}" results=${String(res.length).padStart(2)} ownRank=[${userRanks.join(',')}] rivals=${rivals.length}`
      );
    }
  } catch (e: any) {
    console.log(`  "${kw.phrase.slice(0, 56)}" -> provider error: ${e.message}`);
  }
}
const predictedTop3 = predictedUserRanks.filter((r) => r <= 3).length;
const predictedTop10 = predictedUserRanks.filter((r) => r <= 10).length;
const predictedAvg = predictedUserRanks.length
  ? (predictedUserRanks.reduce((a, b) => a + b, 0) / predictedUserRanks.length).toFixed(1)
  : '—';
console.log(
  `  => after this click the cards would read: Top3=${predictedTop3} Top10=${predictedTop10} Avg=${predictedAvg} ` +
    `(from ${predictedUserRanks.length} own-domain observation(s) across ${pass.length} keywords, plus ${predictedRivalHits} rival observations)`
);
