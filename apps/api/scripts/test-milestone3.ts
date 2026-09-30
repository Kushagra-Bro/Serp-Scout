import {
  searchGoogle,
  searchGoogleMaps,
} from '@serp-scout/serpapi';
import { db, workspaces, businesses, searchRuns, searchResults } from './db/index.js';
import { eq } from 'drizzle-orm';
import { env } from './config/env.js';
import {
  executeSearchRun,
  listSearchRunsForBusiness,
  getSearchRunDetails,
} from './services/search-run.service.js';

async function main() {
  console.log('🧪 Starting Milestone 3: SerpApi Adapter & Search Runs verification...\n');

  // 1. Test live SerpApi Google Web search
  console.log('1️⃣ Testing live SerpApi Google Web Search...');
  const searchResp = await searchGoogle(
    {
      query: 'dentist in Austin TX',
      num: 5,
    },
    env.SERPAPI_KEY
  );

  if (searchResp.results.length === 0) {
    throw new Error('SerpApi Google search returned 0 results');
  }

  console.log(`✅ Retrieved ${searchResp.results.length} organic search results.`);
  console.log(`   #1: "${searchResp.results[0].title}" (${searchResp.results[0].domain})`);
  console.log(`   Detected SERP Features: ${JSON.stringify(searchResp.detectedFeatures)}`);
  if (searchResp.paaQuestions.length > 0) {
    console.log(`   People Also Ask: ${JSON.stringify(searchResp.paaQuestions.slice(0, 2))}`);
  }

  // 2. Test live SerpApi Google Maps search
  console.log('\n2️⃣ Testing live SerpApi Google Maps Search...');
  const mapsResp = await searchGoogleMaps(
    {
      query: 'dentist in Austin TX',
    },
    env.SERPAPI_KEY
  );

  if (mapsResp.results.length === 0) {
    throw new Error('SerpApi Google Maps search returned 0 results');
  }

  console.log(`✅ Retrieved ${mapsResp.results.length} Google Maps Local Pack results.`);
  console.log(`   #1 Map Item: "${mapsResp.results[0].title}" (Rating: ${mapsResp.results[0].rating || 'N/A'}, Address: ${mapsResp.results[0].address || 'N/A'})`);

  // 3. Test Full Search Run Service & Database Persistence
  console.log('\n3️⃣ Testing full Search Run Service pipeline with DB persistence...');
  const testUserId = 'test_serp_user_' + Math.random().toString(36).substring(2, 7);

  // Create test workspace & business
  const [testWs] = await db
    .insert(workspaces)
    .values({
      name: 'Search Run Test Workspace',
      ownerId: testUserId,
      monthlyQuota: 10,
      usedQuota: 0,
    })
    .returning();

  const [testBiz] = await db
    .insert(businesses)
    .values({
      workspaceId: testWs.id,
      name: 'Austin Dental Practice',
      websiteUrl: 'https://austindentalpractice.example.com',
      city: 'Austin',
      country: 'United States',
    })
    .returning();

  try {
    const runResult = await executeSearchRun({
      businessId: testBiz.id,
      workspaceId: testWs.id,
      searchType: 'google',
      query: 'best cosmetic dentist Austin',
      num: 5,
    });

    console.log(`✅ Search run created (ID: ${runResult.run.id}) with status: ${runResult.run.status}`);
    console.log(`✅ Persisted ${runResult.resultsCount} normalized search results to database.`);

    // Verify search_results rows in database
    const dbResults = await db
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchRunId, runResult.run.id));

    if (dbResults.length === 0) {
      throw new Error('search_results records were not found in database');
    }
    console.log(`✅ Database records verified: ${dbResults.length} rows linked to search run.`);

    // Verify workspace quota incremented
    const [updatedWs] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, testWs.id));

    if (updatedWs.usedQuota !== 1) {
      throw new Error(`Expected usedQuota=1, got ${updatedWs.usedQuota}`);
    }
    console.log(`✅ Quota increment verified: ${updatedWs.usedQuota}/${updatedWs.monthlyQuota} units used.`);

    // 4. Test Quota Enforcement (Exceeded Quota)
    console.log('\n4️⃣ Testing Quota Enforcement blocking...');
    await db
      .update(workspaces)
      .set({ usedQuota: 10 })
      .where(eq(workspaces.id, testWs.id));

    let quotaBlocked = false;
    try {
      await executeSearchRun({
        businessId: testBiz.id,
        workspaceId: testWs.id,
        searchType: 'google',
        query: 'should be blocked',
      });
    } catch (err: any) {
      if (err.message.includes('quota exceeded')) {
        quotaBlocked = true;
        console.log(`✅ Over-quota search was properly blocked: "${err.message}"`);
      }
    }

    if (!quotaBlocked) {
      throw new Error('Search was not blocked when workspace was over quota!');
    }

    // 5. Test history and detail retrieval
    console.log('\n5️⃣ Testing search history and detail queries...');
    const history = await listSearchRunsForBusiness(testBiz.id);
    const details = await getSearchRunDetails(runResult.run.id);

    if (history.length === 0 || !details || details.results.length === 0) {
      throw new Error('Search history or details retrieval failed');
    }
    console.log(`✅ Successfully retrieved history (${history.length} runs) and details (${details.results.length} results).`);
  } finally {
    // Cleanup test data
    await db.delete(workspaces).where(eq(workspaces.id, testWs.id));
    console.log('✅ Cleaned up test workspace and child records.');
  }

  console.log('\n🎉 Milestone 3 verification PASSED! SerpApi Adapter & Search Runs is production-ready.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during Milestone 3 test:', err);
  process.exit(1);
});
