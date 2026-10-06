/**
 * Read-only verification for Keyword & Ranking Monitoring.
 * 1. Replays getRankingsForBusiness so we see exactly what the UI receives.
 * 2. Reproduces the keyword-discovery serpTitles query.
 * 3. Shows which 10 keywords refreshKeywordRankings would ever pick.
 * 4. Live-probes Tavily (free provider) to see whether a refresh could record
 *    any rank at all, and the longest title it returns (varchar(255) risk).
 * No DB writes.
 */
import { db, businesses, competitors, keywords, searchRuns, searchResults, rankingObservations } from '../src/db/index.js';
import { getRankingsForBusiness, extractDomainFromUrl } from '../src/services/ranking.service.js';
import { searchTavily } from '../src/services/tavily.service.js';
import { env } from '../src/config/env.js';
import { clampText } from '../src/lib/text.js';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';

const TARGET = process.argv[2] || 'Body fitness gym';

async function main() {
  const bizList = await db.select().from(businesses).limit(50);
  const biz = bizList.find((b) => b.name.trim() === TARGET) || bizList[0];
  console.log(`### target business: "${biz.name}" (${biz.id}) website=${biz.websiteUrl}`);

  // ── 1. What the UI receives ────────────────────────────────────────────────
  const rankings = await getRankingsForBusiness(biz.id);
  const tabTracked = rankings.filter((r) => r.keyword.status === 'tracking' || r.keyword.status === 'approved');
  const tabCandidates = rankings.filter((r) => r.keyword.status === 'candidate');
  const withRank = rankings.filter((r) => r.currentRank !== null);
  const withRival = rankings.filter((r) => r.bestCompetitorRank !== null);
  console.log(
    `\n[1] GET /keywords -> ${rankings.length} rows | default "Tracked" tab shows ${tabTracked.length} | ` +
      `Candidate tab ${tabCandidates.length} | rows with currentRank=${withRank.length} | with bestRival=${withRival.length}`
  );
  for (const r of rankings.slice(0, 3)) {
    console.log(
      `      "${r.keyword.phrase}" status=${r.keyword.status} currentRank=${r.currentRank} prev=${r.previousRank} ` +
        `rival=${r.bestCompetitorRank} (${r.bestCompetitorDomain}) lastObserved=${r.lastObservedAt ?? '-'}`
    );
  }

  // ── 2. keyword-discovery serpTitles query (routes/keywords.ts:92-99) ───────
  const recentRuns = await db
    .select({ id: searchRuns.id, businessId: searchRuns.businessId })
    .from(searchRuns)
    .where(eq(searchRuns.businessId, biz.id))
    .orderBy(desc(searchRuns.requestedAt))
    .limit(10);
  const runIds = recentRuns.map((r) => r.id);
  const buggy = await db
    .select({ title: searchResults.title, searchRunId: searchResults.searchRunId })
    .from(searchResults)
    .where(and(...(runIds.length === 1 ? [eq(searchResults.searchRunId, runIds[0])] : [])))
    .limit(50);
  const ownRunIds = new Set(runIds);
  const foreign = buggy.filter((r) => !ownRunIds.has(r.searchRunId));
  console.log(
    `\n[2] discover serpTitles query: runIds=${runIds.length} -> returned ${buggy.length} rows, ` +
      `${foreign.length} of them belong to OTHER search runs (i.e. other businesses/features):`
  );
  for (const f of foreign.slice(0, 3)) console.log(`      "${f.title.slice(0, 80)}"`);
  const correctCount = runIds.length
    ? (
        await db
          .select({ title: searchResults.title })
          .from(searchResults)
          .where(inArray(searchResults.searchRunId, runIds))
          .limit(50)
      ).length
    : 0;
  console.log(`      (an inArray() version scoped to the business would return ${correctCount})`);

  // ── 3. Which keywords a refresh can ever touch ────────────────────────────
  const all = await db.select({ id: keywords.id, phrase: keywords.phrase, status: keywords.status, score: keywords.opportunityScore })
    .from(keywords).where(eq(keywords.businessId, biz.id));
  // Replicates the fixed refreshKeywordRankings selection: least-recently-checked
  // first (staleness read from search_runs), then highest opportunity score,
  // capped at 10 per pass.
  const eligibleAll = all.filter((k) => ['tracking', 'approved', 'candidate'].includes(k.status));
  const kwRuns = eligibleAll.length
    ? await db
        .select({ query: searchRuns.query, requestedAt: searchRuns.requestedAt })
        .from(searchRuns)
        .where(
          and(
            eq(searchRuns.businessId, biz.id),
            inArray(
              searchRuns.query,
              eligibleAll.map((k) => k.phrase)
            )
          )
        )
    : [];
  const lastChecked = new Map<string, number>();
  for (const r of kwRuns) {
    const key = r.query.trim().toLowerCase();
    const at = new Date(r.requestedAt).getTime();
    if (at > (lastChecked.get(key) ?? 0)) lastChecked.set(key, at);
  }
  const ordered = [...eligibleAll].sort((a, b) => {
    const aChecked = lastChecked.get(a.phrase.trim().toLowerCase()) ?? 0;
    const bChecked = lastChecked.get(b.phrase.trim().toLowerCase()) ?? 0;
    if (aChecked !== bChecked) return aChecked - bChecked;
    return b.score - a.score;
  });
  const pass1 = ordered.slice(0, 10);
  console.log(
    `\n[3] fixed refresh selection: ${eligibleAll.length} eligible, ${lastChecked.size} phrases already checked at least once`
  );
  console.log(`      pass 1 (this click) picks:`);
  for (const e of pass1) {
    const checked = lastChecked.get(e.phrase.trim().toLowerCase());
    console.log(
      `        - ${e.phrase} (score ${e.score}, ${checked ? 'last checked ' + new Date(checked).toISOString() : 'NEVER checked'})`
    );
  }
  // Simulate the next click: this pass's keywords now have a fresh search run.
  const now = Date.now();
  const pass2 = [...eligibleAll]
    .map((k) => ({
      ...k,
      seen: pass1.some((p) => p.id === k.id) ? now : lastChecked.get(k.phrase.trim().toLowerCase()) ?? 0,
    }))
    .sort((a, b) => a.seen - b.seen || b.score - a.score)
    .slice(0, 10);
  console.log(`      pass 2 (next click) would pick:`);
  for (const e of pass2) console.log(`        - ${e.phrase}`);
  const covered = new Set([...pass1, ...pass2].map((k) => k.id));
  console.log(`      => 2 clicks now cover ${covered.size} of ${eligibleAll.length} keywords (was: same 10 forever)`);

  // ── 4. Live probe: could a refresh record anything? ───────────────────────
  const comps = await db.select({ domain: competitors.domain }).from(competitors).where(eq(competitors.businessId, biz.id));
  const compDomains = new Set(comps.map((c) => c.domain.toLowerCase()));
  const userDomain = extractDomainFromUrl(biz.websiteUrl);
  const probes = pass1.slice(0, 2);
  console.log(
    `\n[4] live Tavily probe (provider auto -> tavily, free). userDomain="${userDomain}" knownCompetitors=${comps.length}`
  );
  for (const p of probes) {
    const q = `${p.phrase}`;
    try {
      const res = await searchTavily({ query: q, apiKey: env.TAVILY_API_KEY!, num: 20 });
      const own = res.filter((r) => r.domain.toLowerCase().includes(userDomain));
      const rivals = res.filter((r) => compDomains.has(r.domain.toLowerCase()));
      const maxTitle = res.reduce((m, r) => Math.max(m, (r.title || '').length), 0);
      console.log(
        `      "${q}" -> ${res.length} results; ownDomain hits=${own.length} (rank ${own.map((o) => o.rank).join(',') || '-'}), ` +
          `known-rival hits=${rivals.length} (ranks ${rivals.map((o) => o.rank).join(',') || '-'}), longest title=${maxTitle} chars`
      );
      console.log(
        `         top5: ${res.slice(0, 5).map((r) => `${r.rank}.${r.domain}`).join(' ')}`
      );
    } catch (e: any) {
      console.log(`      "${q}" -> Tavily FAILED: ${e.message}`);
    }
  }

  const [maxObs] = await db
    .select({ domain: rankingObservations.domain })
    .from(rankingObservations)
    .where(eq(rankingObservations.businessId, biz.id))
    .limit(1);
  console.log(`\n[5] observations rows exist for this business: ${maxObs ? 'yes' : 'no'}`);

  // ── 6. Regression checks for the applied fixes ────────────────────────────
  console.log(`\n[6] fix regression checks`);
  const clamped = clampText('x'.repeat(400), 255);
  console.log(
    `      clampText(400-char value, 255) -> ${clamped?.length} chars (column-safe: ${clamped?.length === 255})`
  );
  console.log(
    `      search_runs rows that ever failed with a varchar overflow: ` +
      `${(await db.select({ id: searchRuns.id }).from(searchRuns).where(sql`${searchRuns.errorMessage} like '%varying(255)%'`)).length}`
  );
  console.log(
    `      search_results rows last written with a URL-shaped domain: ` +
      `${(await db.select({ domain: searchResults.domain }).from(searchResults)).filter((r) => r.domain.includes('/')).length}`
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
