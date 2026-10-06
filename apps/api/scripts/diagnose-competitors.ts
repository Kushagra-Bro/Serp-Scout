/**
 * Read-only diagnostic for the "Competitor Discovery & Radar" pipeline.
 *
 * Reproduces exactly what POST /api/businesses/:id/competitors/discover does
 * with the stored search_results rows, without writing anything or calling any
 * paid API, and reports where candidates get dropped.
 */
import { db, businesses, searchRuns, searchResults, competitors, services } from '../src/db/index.js';
import { extractCompetitorCandidates, extractDomain, fastClassifyByDomain, RawSearchItemWithContext } from '@serp-scout/agents';
import { eq, desc, and, sql } from 'drizzle-orm';

async function main() {
  const bizList = await db.select().from(businesses).limit(50);
  console.log(`\n=== ${bizList.length} business(es) ===`);

  for (const biz of bizList) {
    const runs = await db
      .select({
        id: searchRuns.id,
        searchType: searchRuns.searchType,
        provider: searchRuns.provider,
        status: searchRuns.status,
        query: searchRuns.query,
        errorMessage: searchRuns.errorMessage,
        requestedAt: searchRuns.requestedAt,
      })
      .from(searchRuns)
      .where(eq(searchRuns.businessId, biz.id))
      .orderBy(desc(searchRuns.requestedAt))
      .limit(12);

    const [{ count: rowCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchResults)
      .innerJoin(searchRuns, eq(searchResults.searchRunId, searchRuns.id))
      .where(eq(searchRuns.businessId, biz.id));

    const comps = await db
      .select({
        domain: competitors.domain,
        type: competitors.competitorType,
        score: competitors.confidenceScore,
        status: competitors.status,
      })
      .from(competitors)
      .where(eq(competitors.businessId, biz.id));

    const svcs = await db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.businessId, biz.id));

    console.log(`\n--- BUSINESS: ${biz.name} (${biz.id})`);
    console.log(`    city=${biz.city} industry=${biz.industry} website=${biz.websiteUrl}`);
    console.log(`    services=[${svcs.map((s) => s.name).join(', ')}]`);
    console.log(`    stored search_results rows: ${rowCount}   competitors rows: ${comps.length}`);
    console.log(`    runs (newest first):`);
    for (const r of runs) {
      console.log(
        `      [${r.status}] ${r.searchType}/${r.provider} q="${r.query}" ` +
          `${r.errorMessage ? `ERR=${String(r.errorMessage).slice(0, 120)}` : ''}`
      );
    }
    if (comps.length) {
      console.log(`    competitors:`);
      for (const c of comps) console.log(`      ${c.domain} type=${c.type} score=${c.score} status=${c.status}`);
    }

    // ── Reproduce the route's row -> RawSearchItemWithContext mapping ────────
    const existingResults = await db
      .select({ result: searchResults, run: searchRuns })
      .from(searchResults)
      .innerJoin(searchRuns, eq(searchResults.searchRunId, searchRuns.id))
      .where(eq(searchRuns.businessId, biz.id))
      .limit(100);

    if (existingResults.length === 0) {
      console.log('    >> no stored results: the discover route would run a fresh sweep');
      continue;
    }

    const searchItems: RawSearchItemWithContext[] = existingResults.map(({ result, run }) => ({
      query: run.query,
      source: run.searchType === 'google_maps' ? 'google_maps' : 'google',
      item: {
        rank: result.rank,
        title: result.title,
        url: result.url,
        domain: result.domain,
        snippet: result.snippet || undefined,
        rating: result.rating ? Number(result.rating) : undefined,
        reviewsCount: result.reviewCount || undefined,
        address: result.locationText || undefined,
        raw: result.rawReference as Record<string, any>,
      } as any,
    }));

    const bySource: Record<string, number> = {};
    for (const si of searchItems) bySource[si.source] = (bySource[si.source] || 0) + 1;
    console.log(`    route searchItems: ${JSON.stringify(bySource)}`);

    // Per-row drop analysis (mirrors candidate-extractor.ts logic)
    let droppedNoUrl = 0;
    let droppedSelfOrBadDomain = 0;
    const userDomain = biz.websiteUrl ? extractDomain(biz.websiteUrl) : '';
    const domainsSeen = new Map<string, number>();
    for (const { query, source, item } of searchItems) {
      const anyItem = item as any;
      let url = '';
      if (source === 'google') {
        url = anyItem.url;
      } else {
        url = anyItem.website || (anyItem.raw?.link as string) || '';
      }
      if (!url) {
        droppedNoUrl++;
        continue;
      }
      const d = extractDomain(url);
      if (!d || (userDomain && d === userDomain)) {
        droppedSelfOrBadDomain++;
        continue;
      }
      domainsSeen.set(d, (domainsSeen.get(d) || 0) + 1);
    }
    console.log(
      `    extractor drop analysis: no-url=${droppedNoUrl} self/bad-domain=${droppedSelfOrBadDomain} ` +
        `kept=${searchItems.length - droppedNoUrl - droppedSelfOrBadDomain} uniqueDomains=${domainsSeen.size}`
    );

    const candidates = extractCompetitorCandidates(searchItems, biz.websiteUrl);
    console.log(`    extractCompetitorCandidates -> ${candidates.length} candidates`);
    for (const c of candidates.slice(0, 12)) {
      const fast = fastClassifyByDomain(c.domain);
      console.log(
        `      ${c.domain} (name=${c.name.slice(0, 40)}) apps=${c.appearancesCount} bestRank=${c.bestRank} ` +
          `mapsUrl=${!!c.mapsUrl} fastClass=${fast ?? '-'}`
      );
    }

    // Maps raw shape probe: does raw carry `link` / `website`?
    const mapsRows = existingResults.filter((r) => r.run.searchType === 'google_maps');
    if (mapsRows.length) {
      const sample = mapsRows[0].result as any;
      const rawKeys = Object.keys(sample.rawReference || {}).slice(0, 25);
      console.log(`    maps sample row: url="${sample.url}" domain="${sample.domain}"`);
      console.log(`    maps sample raw keys: ${rawKeys.join(', ')}`);
      console.log(
        `    maps sample raw.link=${String((sample.rawReference as any)?.link)} ` +
          `raw.website=${String((sample.rawReference as any)?.website)}`
      );
      const usable = mapsRows.filter((r) => (r.result as any).url).length;
      console.log(`    maps rows with non-empty url: ${usable}/${mapsRows.length}`);
      const withRawLink = mapsRows.filter((r) => (r.result as any).rawReference?.link).length;
      const withRawWebsite = mapsRows.filter((r) => (r.result as any).rawReference?.website).length;
      console.log(`    maps rows with raw.link: ${withRawLink}  with raw.website: ${withRawWebsite}`);
    }
  }

  console.log('\n=== done ===');
}

main().catch((err) => {
  console.error('diagnostic failed:', err);
  process.exit(1);
});
