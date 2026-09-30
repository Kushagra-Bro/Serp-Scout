import {
  generateKeywordCandidates,
  classifyKeywordIntent,
  computeOpportunityScore,
  discoverKeywords,
} from '@serp-scout/agents';
import {
  db,
  workspaces,
  businesses,
  services,
  keywords,
  competitors,
  searchRuns,
  rankingObservations,
} from './db/index.js';
import { eq, and } from 'drizzle-orm';
import { env } from './config/env.js';
import {
  recordRankingObservations,
  getRankingsForBusiness,
} from './services/ranking.service.js';

async function main() {
  console.log('🧪 Starting Milestone 5: Keyword & Ranking Monitoring verification...\n');

  // 1. Test Candidate Keyword Generation
  console.log('1️⃣ Testing Keyword Candidate Generator...');
  const candidatePhrases = generateKeywordCandidates({
    businessName: 'Austin Smile Studio',
    category: 'Cosmetic Dentist',
    services: ['Teeth Whitening', 'Dental Implants', 'Invisalign'],
    city: 'Austin',
    paaQuestions: [
      'How much does cosmetic dentistry cost in Austin?',
      'Who is the best dentist in Austin TX?',
    ],
    websiteKeywords: ['austin dentist', 'family dentistry austin'],
  });

  console.log(`   Generated ${candidatePhrases.length} normalized keyword candidates.`);
  console.log('   Sample candidates:', candidatePhrases.slice(0, 5));

  if (candidatePhrases.length < 5) {
    throw new Error('Keyword generator failed to generate sufficient candidate phrases');
  }
  console.log('✅ Candidate keyword generation verified.');

  // 2. Test Groq Intent Classifier & Opportunity Scorer
  console.log('\n2️⃣ Testing Groq AI Intent Classifier & Scoring...');
  const testPhrase = 'emergency dentist Austin TX';
  const intentResult = await classifyKeywordIntent(
    testPhrase,
    {
      businessName: 'Austin Smile Studio',
      category: 'Cosmetic Dentist',
      services: ['Teeth Whitening', 'Dental Implants', 'Invisalign'],
      city: 'Austin',
    },
    env.GROQ_API_KEY
  );

  console.log(`   Query: "${testPhrase}"`);
  console.log(`   Classified Intent: ${intentResult.intent}`);
  console.log(`   Business Relevance: ${intentResult.businessRelevance}/100`);
  console.log(`   Commercial Score: ${intentResult.commercialScore}/100`);
  console.log(`   Local Fit: ${intentResult.localFit}/100`);
  console.log(`   Rationale: "${intentResult.reasoning}"`);

  if (!['local', 'problem-based', 'transactional', 'commercial'].includes(intentResult.intent)) {
    throw new Error(`Unexpected intent classification: ${intentResult.intent}`);
  }

  // Test Weighted Opportunity Scorer
  console.log('\n3️⃣ Testing Weighted Opportunity Scorer Formula...');
  // 30% relevance + 25% commercial + 20% ranking potential + 15% local fit + 10% content gap
  const directOppResult = computeOpportunityScore({
    businessRelevance: 90, // direct service match
    commercialIntent: 85,
    localFit: 95,
    currentRank: 6, // striking distance (rank 4-10 = 95 potential)
    bestCompetitorRank: 2, // competitor dominates top 5 = 95 content gap
  });

  console.log(`   Calculated Opportunity Score for Direct Service ("teeth whitening Austin"): ${directOppResult.score}/100`);
  console.log(`   Breakdown:`, directOppResult.breakdown);
  console.log(`   Ranking Potential: ${directOppResult.rankingPotential}/100, Content Gap: ${directOppResult.contentGap}/100`);

  if (directOppResult.score < 80) {
    throw new Error('Opportunity score should be high (>=80) for a striking-distance high-intent local query');
  }

  const moderateOppResult = computeOpportunityScore({
    businessRelevance: intentResult.businessRelevance,
    commercialIntent: intentResult.commercialScore,
    localFit: intentResult.localFit,
    currentRank: 6,
    bestCompetitorRank: 2,
  });
  console.log(`   Calculated Opportunity Score for Emergency Query: ${moderateOppResult.score}/100`);
  console.log('✅ Opportunity scorer formula verified.');

  // 4. Test Full Discovery Pipeline
  console.log('\n4️⃣ Testing Complete Keyword Discovery Pipeline...');
  const discovered = await discoverKeywords({
    business: {
      name: 'Austin Smile Studio',
      category: 'Cosmetic Dentist',
      services: ['Teeth Whitening', 'Dental Implants'],
      city: 'Austin',
    },
    maxAiEnrichments: 3,
    apiKey: env.GROQ_API_KEY,
  });

  console.log(`   Discovered ${discovered.length} ranked keywords:`);
  for (const k of discovered.slice(0, 4)) {
    console.log(`   - "${k.phrase}" -> Intent: ${k.intent}, Opportunity Score: ${k.opportunityScore}`);
  }
  console.log('✅ Keyword discovery pipeline successfully executed.');

  // 5. Database Persistence, Observations & Delta Calculation
  console.log('\n5️⃣ Testing DB Persistence, Ranking Observations & Delta Tracking...');
  const testUserId = 'test_kw_user_' + Math.random().toString(36).substring(2, 7);

  const [testWs] = await db
    .insert(workspaces)
    .values({
      name: 'Keyword Test Workspace',
      ownerId: testUserId,
    })
    .returning();

  const [testBiz] = await db
    .insert(businesses)
    .values({
      workspaceId: testWs.id,
      name: 'Austin Smile Studio',
      websiteUrl: 'https://austinsmilestudio.example.com',
      city: 'Austin',
    })
    .returning();

  const [testComp] = await db
    .insert(competitors)
    .values({
      businessId: testBiz.id,
      name: 'Rival Dental Group',
      domain: 'rivaldental.example.com',
      websiteUrl: 'https://rivaldental.example.com',
      status: 'confirmed',
      confidenceScore: 90,
    })
    .returning();

  // Insert a tracking keyword
  const [testKw] = await db
    .insert(keywords)
    .values({
      businessId: testBiz.id,
      phrase: 'teeth whitening austin tx',
      location: 'Austin, TX',
      intent: 'commercial',
      status: 'tracking',
      opportunityScore: 88,
    })
    .returning();

  console.log(`✅ Created tracking keyword "${testKw.phrase}" (ID: ${testKw.id})`);

  // Insert valid search runs for foreign key
  const [run1] = await db
    .insert(searchRuns)
    .values({
      businessId: testBiz.id,
      searchType: 'google',
      query: 'teeth whitening austin tx',
      status: 'completed',
    })
    .returning();

  // Record Run 1: user is rank 8, rival is rank 3
  console.log('   Simulating Search Run 1 (User Rank: #8, Rival: #3)...');
  await recordRankingObservations({
    businessId: testBiz.id,
    keywordId: testKw.id,
    searchRunId: run1.id,
    results: [
      { rank: 3, url: 'https://rivaldental.example.com/whitening', domain: 'rivaldental.example.com' },
      { rank: 8, url: 'https://austinsmilestudio.example.com/teeth-whitening', domain: 'austinsmilestudio.example.com' },
    ],
  });

  let rankings = await getRankingsForBusiness(testBiz.id);
  console.log(`   Run 1: Current Rank = #${rankings[0].currentRank}, Rival = #${rankings[0].bestCompetitorRank}, Delta = ${rankings[0].delta}`);

  if (rankings[0].currentRank !== 8 || rankings[0].bestCompetitorRank !== 3) {
    throw new Error('Run 1 ranking observations recorded incorrectly');
  }

  const [run2] = await db
    .insert(searchRuns)
    .values({
      businessId: testBiz.id,
      searchType: 'google',
      query: 'teeth whitening austin tx',
      status: 'completed',
    })
    .returning();

  // Record Run 2: user improves to rank 4 (+4 delta improvement)
  console.log('   Simulating Search Run 2 (User improves to Rank: #4)...');
  await recordRankingObservations({
    businessId: testBiz.id,
    keywordId: testKw.id,
    searchRunId: run2.id,
    results: [
      { rank: 2, url: 'https://rivaldental.example.com/whitening', domain: 'rivaldental.example.com' },
      { rank: 4, url: 'https://austinsmilestudio.example.com/teeth-whitening', domain: 'austinsmilestudio.example.com' },
    ],
  });

  rankings = await getRankingsForBusiness(testBiz.id);
  console.log(`   Run 2: Current Rank = #${rankings[0].currentRank}, Previous = #${rankings[0].previousRank}, Delta = +${rankings[0].delta}`);

  if (rankings[0].currentRank !== 4 || rankings[0].previousRank !== 8 || rankings[0].delta !== 4) {
    throw new Error(`Delta calculation failed: expected +4, got ${rankings[0].delta}`);
  }
  console.log('✅ Historical ranking delta correctly calculated as +4 position improvement!');

  // Cleanup test workspace
  await db.delete(workspaces).where(eq(workspaces.id, testWs.id));
  console.log('✅ Cleaned up test database resources.');

  console.log('\n🎉 ALL MILESTONE 5 VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉');
}

main().catch((err) => {
  console.error('\n❌ Milestone 5 verification failed:', err);
  process.exit(1);
});
