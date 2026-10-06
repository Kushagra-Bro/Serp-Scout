/**
 * Verification for the maps/3-Pack candidate fix.
 * Read-only: replays the stored search_results rows through the real
 * `extractCompetitorCandidates` / `discoverCompetitors` from @serp-scout/agents.
 * Performs no database writes and no homepage scraping (profile cap = 0).
 */
import { db, businesses, searchRuns, searchResults, services } from '../src/db/index.js';
import { extractCompetitorCandidates, discoverCompetitors, fastClassifyByDomain, RawSearchItemWithContext } from '@serp-scout/agents';
import { eq } from 'drizzle-orm';

async function main() {
  const bizList = await db.select().from(businesses).limit(50);
  for (const biz of bizList) {
    const rows = await db
      .select({ result: searchResults, run: searchRuns })
      .from(searchResults)
      .innerJoin(searchRuns, eq(searchResults.searchRunId, searchRuns.id))
      .where(eq(searchRuns.businessId, biz.id))
      .limit(150);
    const svcs = await db.select({ name: services.name }).from(services).where(eq(services.businessId, biz.id));
    if (rows.length === 0) {
      console.log(`\n### ${biz.name}: no stored rows`);
      continue;
    }
    const searchItems: RawSearchItemWithContext[] = rows.map(({ result, run }) => ({
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

    const cands = extractCompetitorCandidates(searchItems, biz.websiteUrl);
    const mapsDerived = cands.filter((c) => c.mapsUrl && c.appearancesCount >= 1 && c.address);
    console.log(
      `\n### ${biz.name}: rows=${rows.length} (maps=${rows.filter((r) => r.run.searchType === 'google_maps').length}) ` +
        `-> extractor candidates=${cands.length} (local/maps-sourced=${mapsDerived.length})`
    );

    if (biz.name.trim() === 'Body fitness gym') {
      console.log('    running full discoverCompetitors (classification only, no scraping)...');
      const discovered = await discoverCompetitors({
        business: {
          name: biz.name,
          websiteUrl: biz.websiteUrl,
          category: biz.industry || undefined,
          services: svcs.map((s) => s.name),
          city: biz.city || '',
        },
        searchItems,
        maxCandidatesToEnrich: 6,
        maxCandidatesToProfile: 0,
      });
      console.log(`    -> ${discovered.length} scored competitors:`);
      for (const d of discovered.slice(0, 10)) {
        console.log(
          `       ${d.name.slice(0, 34).padEnd(34)} ${String(d.domain).padEnd(26)} type=${String(d.competitorType).padEnd(10)} ` +
            `score=${d.confidenceScore} threat=${d.threatLevel} rating=${d.rating ?? '-'} reviews=${d.reviewCount ?? '-'} ` +
            `proximity="${d.proximityLabel}"`
        );
      }
    } else {
      const recovered = cands.filter((c) => c.mapsUrl && c.address).slice(0, 5);
      for (const c of recovered) {
        console.log(`      ${String(c.domain).padEnd(30)} "${c.name.slice(0, 30)}" rating=${c.rating ?? '-'} reviews=${c.reviewsCount ?? '-'} fastClass=${fastClassifyByDomain(c.domain) ?? '-'}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
