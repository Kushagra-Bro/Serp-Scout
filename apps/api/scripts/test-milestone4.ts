import {
  planCompetitorQueries,
  extractCompetitorCandidates,
  classifyCompetitorCandidate,
  computeCompetitorConfidenceScore,
  discoverCompetitors,
  RawSearchItemWithContext,
} from '@serp-scout/agents';
import { db, workspaces, businesses, services, competitors } from './db/index.js';
import { eq, and } from 'drizzle-orm';
import { env } from './config/env.js';

async function main() {
  console.log('🧪 Starting Milestone 4: Competitor Discovery verification...\n');

  // 1. Test Query Planner
  console.log('1️⃣ Testing Query Planner (5 query groups)...');
  const planned = planCompetitorQueries({
    businessName: 'Apex Family Dental',
    category: 'Dental Clinic',
    services: ['Teeth Whitening', 'Dental Implants', 'Invisalign'],
    city: 'Austin',
  });

  console.log(`   Service Queries (${planned.serviceQueries.length}):`, planned.serviceQueries.slice(0, 2));
  console.log(`   Local Queries (${planned.localQueries.length}):`, planned.localQueries.slice(0, 2));
  console.log(`   Commercial Queries (${planned.commercialQueries.length}):`, planned.commercialQueries.slice(0, 2));
  console.log(`   Problem-Based Queries (${planned.problemBasedQueries.length}):`, planned.problemBasedQueries.slice(0, 2));
  console.log(`   Comparison Queries (${planned.comparisonQueries.length}):`, planned.comparisonQueries.slice(0, 2));

  if (
    planned.serviceQueries.length === 0 ||
    planned.localQueries.length === 0 ||
    planned.commercialQueries.length === 0 ||
    planned.problemBasedQueries.length === 0 ||
    planned.comparisonQueries.length === 0
  ) {
    throw new Error('Query planner failed to generate all 5 query groups');
  }
  console.log('✅ Query Planner generates all 5 query categories correctly.');

  // 2. Test Candidate Extractor & Deduplication
  console.log('\n2️⃣ Testing Candidate Extractor & Deduplication...');
  const sampleSearchItems: RawSearchItemWithContext[] = [
    {
      query: 'dentist in Austin TX',
      source: 'google',
      item: {
        rank: 1,
        title: 'Austin Dental Arts - Cosmetic & Family Dentistry',
        url: 'https://austindentalarts.com/services',
        domain: 'austindentalarts.com',
        snippet: 'Offering premier teeth whitening, dental implants, and dental checkups in Austin.',
        rating: 4.9,
        reviewsCount: 140,
      },
    },
    {
      query: 'best dental implants Austin',
      source: 'google',
      item: {
        rank: 2,
        title: 'Austin Dental Arts - Dental Implants Specialist',
        url: 'https://austindentalarts.com/implants',
        domain: 'austindentalarts.com',
        snippet: 'Restore your smile with permanent dental implants at Austin Dental Arts.',
      },
    },
    {
      query: 'dentist in Austin TX',
      source: 'google',
      item: {
        rank: 3,
        title: 'The 10 Best Dentists in Austin, TX - Yelp',
        url: 'https://www.yelp.com/search?cflt=dentists&find_loc=Austin%2C+TX',
        domain: 'yelp.com',
        snippet: 'Top 10 Best Dentists near you in Austin, Texas.',
      },
    },
    {
      query: 'invisalign Austin',
      source: 'google_maps',
      item: {
        rank: 1,
        title: 'Smile Doctors Orthodontics',
        url: 'https://smiledoctors.com/locations/austin',
        domain: 'smiledoctors.com',
        snippet: 'Orthodontic care and Invisalign clear aligners in South Austin.',
        rating: 4.8,
        reviewsCount: 210,
        address: '123 South Congress, Austin, TX',
      },
    },
    {
      query: 'Apex Family Dental reviews',
      source: 'google',
      item: {
        rank: 1,
        title: 'Apex Family Dental - Home',
        url: 'https://apexfamilydental.com',
        domain: 'apexfamilydental.com',
        snippet: 'Welcome to Apex Family Dental.',
      },
    },
  ];

  const extracted = extractCompetitorCandidates(
    sampleSearchItems,
    'https://apexfamilydental.com'
  );

  console.log(`   Extracted ${extracted.length} candidate domains (excluding self).`);
  for (const c of extracted) {
    console.log(`   - Domain: ${c.domain}, Appearances: ${c.appearancesCount}, Best Rank: ${c.bestRank}, Maps: ${!!c.mapsUrl}`);
  }

  const austinDental = extracted.find((e) => e.domain === 'austindentalarts.com');
  const yelp = extracted.find((e) => e.domain === 'yelp.com');
  const self = extracted.find((e) => e.domain === 'apexfamilydental.com');

  if (!austinDental || austinDental.appearancesCount !== 2) {
    throw new Error('Deduplication or appearance count failed for austindentalarts.com');
  }
  if (!yelp) {
    throw new Error('Candidate extraction missed yelp.com');
  }
  if (self) {
    throw new Error('Failed to exclude the business itself from candidates');
  }
  console.log('✅ Candidate extraction & deduplication working properly.');

  // 3. Test Groq Classification & Scorer
  console.log('\n3️⃣ Testing Competitor Classification & Scoring...');
  const directScore = computeCompetitorConfidenceScore(austinDental, 'direct', {
    services: ['Teeth Whitening', 'Dental Implants', 'Invisalign'],
    city: 'Austin',
    category: 'Dental Clinic',
  });
  console.log(`   Confidence Score for direct competitor (austindentalarts.com): ${directScore}/100`);

  const directoryScore = computeCompetitorConfidenceScore(yelp, 'directory', {
    services: ['Teeth Whitening', 'Dental Implants', 'Invisalign'],
    city: 'Austin',
    category: 'Dental Clinic',
  });
  console.log(`   Confidence Score for directory (yelp.com): ${directoryScore}/100`);

  if (directScore <= directoryScore) {
    throw new Error('Direct competitor score should be substantially higher than directory score');
  }

  // Test AI classifier with Groq
  console.log('   Testing Groq classification on direct candidate...');
  const classifiedDirect = await classifyCompetitorCandidate(
    austinDental,
    {
      businessName: 'Apex Family Dental',
      category: 'Dental Clinic',
      services: ['Teeth Whitening', 'Dental Implants', 'Invisalign'],
      city: 'Austin',
    },
    env.GROQ_API_KEY
  );
  console.log(`   Classifier Result: ${classifiedDirect.competitorType} (Reason: ${classifiedDirect.reasoning})`);

  // 4. Test Complete Discovery Pipeline
  console.log('\n4️⃣ Testing Complete Discovery Pipeline...');
  const discovered = await discoverCompetitors({
    business: {
      name: 'Apex Family Dental',
      websiteUrl: 'https://apexfamilydental.com',
      category: 'Dental Clinic',
      services: ['Teeth Whitening', 'Dental Implants', 'Invisalign'],
      city: 'Austin',
    },
    searchItems: sampleSearchItems,
    maxCandidatesToEnrich: 3,
    apiKey: env.GROQ_API_KEY,
  });

  console.log(`   Discovered ${discovered.length} ranked competitors:`);
  for (const d of discovered) {
    console.log(`   - ${d.name} (${d.domain}) -> Score: ${d.confidenceScore}, Type: ${d.competitorType}`);
  }

  if (discovered.length === 0 || discovered[0].confidenceScore < discovered[discovered.length - 1].confidenceScore) {
    throw new Error('Competitor ranking by confidence score is invalid');
  }
  console.log('✅ Competitor discovery pipeline working and sorted by confidence.');

  // 5. Database Persistence & CRUD Verification
  console.log('\n5️⃣ Testing Competitor DB CRUD & Workspace Isolation...');
  const testUserId = 'test_comp_user_' + Math.random().toString(36).substring(2, 7);

  const [testWs] = await db
    .insert(workspaces)
    .values({
      name: 'Competitor Test Workspace',
      ownerId: testUserId,
    })
    .returning();

  const [testBiz] = await db
    .insert(businesses)
    .values({
      workspaceId: testWs.id,
      name: 'Apex Family Dental',
      websiteUrl: 'https://apexfamilydental.com',
      city: 'Austin',
      country: 'United States',
    })
    .returning();

  const [testSvc] = await db
    .insert(services)
    .values({
      businessId: testBiz.id,
      name: 'Teeth Whitening',
    })
    .returning();

  // Insert discovered candidate
  const topCandidate = discovered[0];
  const [createdComp] = await db
    .insert(competitors)
    .values({
      businessId: testBiz.id,
      name: topCandidate.name,
      domain: topCandidate.domain,
      websiteUrl: topCandidate.websiteUrl,
      mapsUrl: topCandidate.mapsUrl,
      category: topCandidate.category,
      competitorType: topCandidate.competitorType,
      confidenceScore: topCandidate.confidenceScore,
      status: 'candidate',
    })
    .returning();

  console.log(`✅ Inserted competitor candidate "${createdComp.name}" (ID: ${createdComp.id})`);

  // Update status to 'confirmed'
  const [confirmedComp] = await db
    .update(competitors)
    .set({
      status: 'confirmed',
      userNotes: 'Key local rival on Congress Ave.',
      updatedAt: new Date(),
    })
    .where(eq(competitors.id, createdComp.id))
    .returning();

  if (confirmedComp.status !== 'confirmed') {
    throw new Error('Failed to update competitor status');
  }
  console.log(`✅ Updated competitor status to "confirmed" with user notes.`);

  // Cleanup test workspace and its cascade
  await db.delete(workspaces).where(eq(workspaces.id, testWs.id));
  console.log('✅ Cleaned up test database resources.');

  console.log('\n🎉 ALL MILESTONE 4 VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉');
}

main().catch((err) => {
  console.error('\n❌ Milestone 4 verification failed:', err);
  process.exit(1);
});
