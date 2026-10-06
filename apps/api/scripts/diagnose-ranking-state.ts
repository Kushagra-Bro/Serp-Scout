/**
 * Read-only: ranking-monitoring arm state + failure forensics.
 */
import { db, businesses, workspaces, searchRuns, searchResults, keywords } from '../src/db/index.js';
import { eq, sql, and, inArray } from 'drizzle-orm';

const bizList = await db.select().from(businesses).limit(50);
const wsList = await db.select().from(workspaces);
const wsById = new Map(wsList.map((w) => [w.id, w]));

console.log('=== automation arm state ===');
for (const b of bizList) {
  const w = wsById.get(b.workspaceId);
  console.log(
    `  ${b.name.padEnd(26)} lastAnalyzedAt=${b.lastAnalyzedAt ? new Date(b.lastAnalyzedAt).toISOString() : 'NULL'} ` +
      `dataStale=${b.dataStale} cadence=${w?.refreshCadence ?? 'n/a'} lastScheduledRunAt=${w?.lastScheduledRunAt ? new Date(w.lastScheduledRunAt).toISOString() : 'NULL'}`
  );
}

console.log('\n=== longest stored Tavily titles (search_results.business_name varchar(255), title text) ===');
const longRows = await db
  .select({
    businessId: searchRuns.businessId,
    provider: searchRuns.provider,
    searchType: searchRuns.searchType,
    titleLen: sql<number>`length(${searchResults.title})::int`,
    bizNameLen: sql<number>`length(${searchResults.businessName})::int`,
    domainLen: sql<number>`length(${searchResults.domain})::int`,
    urlLen: sql<number>`length(${searchResults.url})::int`,
    title: searchResults.title,
  })
  .from(searchResults)
  .innerJoin(searchRuns, eq(searchResults.searchRunId, searchRuns.id))
  .orderBy(sql`length(${searchResults.title}) desc`)
  .limit(5);
for (const r of longRows) {
  console.log(
    `  ${r.provider}/${r.searchType} titleLen=${r.titleLen} bizNameLen=${r.bizNameLen} domainLen=${r.domainLen} urlLen=${r.urlLen} :: ${r.title.slice(0, 90)}`
  );
}

console.log('\n=== failed runs w/ full error ===');
const failed = await db
  .select({
    businessId: searchRuns.businessId, searchType: searchRuns.searchType, provider: searchRuns.provider,
    query: searchRuns.query, location: searchRuns.location, errorMessage: searchRuns.errorMessage,
    requestedAt: searchRuns.requestedAt,
  })
  .from(searchRuns)
  .where(eq(searchRuns.status, 'failed'));
for (const r of failed) {
  console.log(`  [${r.searchType}/${r.provider}] q="${r.query}"\n     loc="${r.location}"\n     err=${String(r.errorMessage).replace(/\s+/g, ' ').slice(0, 260)}`);
}

console.log('\n=== ranking-refresh runs (run.query matches a keyword phrase) ===');
for (const b of bizList) {
  const kws = await db.select({ id: keywords.id, phrase: keywords.phrase, status: keywords.status }).from(keywords).where(eq(keywords.businessId, b.id));
  if (!kws.length) continue;
  const phrases = new Set(kws.map((k) => k.phrase.toLowerCase()));
  const runs = await db
    .select({ query: searchRuns.query, status: searchRuns.status, provider: searchRuns.provider, searchType: searchRuns.searchType })
    .from(searchRuns)
    .where(eq(searchRuns.businessId, b.id));
  const kwRuns = runs.filter((r) => phrases.has(r.query.toLowerCase()));
  console.log(`  ${b.name.padEnd(26)} keywords=${kws.length} runs-matching-keyword-phrase=${kwRuns.length} (of ${runs.length} total runs)`);
}
