import {
  analyzeContentGaps,
  analyzeCompetitorMessaging,
  analyzeCustomerReviews,
  analyzeNewsSignals,
  detectSearchRunChanges,
} from '@serp-scout/agents';
import {
  db,
  workspaces,
  businesses,
  competitors,
  contentGaps,
  reviewThemes,
} from './db/index.js';
import { eq, and } from 'drizzle-orm';
import { env } from './config/env.js';

async function main() {
  console.log('🧪 Starting Milestone 6: SEO & Market Analysis Agents verification...\n');

  // 1. Test Content Gap Agent
  console.log('1️⃣ Testing Content Gap Agent...');
  const testBusiness = {
    name: 'Austin Modern Dentistry',
    websiteUrl: 'https://austinmoderndentistry.example.com',
    services: ['Routine Cleanings', 'Cavity Fillings', 'Teeth Whitening'],
    city: 'Austin',
  };

  const testCompetitors = [
    {
      name: 'Apex Dental Care',
      domain: 'apexdental.example.com',
      websiteUrl: 'https://apexdental.example.com',
      observedSnippets: [
        'Premier emergency dental appointments & same day root canal treatment in South Austin.',
        'Clear aligners & Invisalign certified provider. Flexible 0% financing available.',
      ],
      titles: ['Emergency Dentist Austin TX - Same Day Appointments', 'Invisalign & Clear Braces in Austin'],
    },
    {
      name: 'South Congress Dental Studio',
      domain: 'socodental.example.com',
      websiteUrl: 'https://socodental.example.com',
      observedSnippets: ['Cosmetic veneers & full mouth smile makeovers. Schedule your free 3D digital scan today.'],
      titles: ['Cosmetic Porcelain Veneers - SoCo Austin'],
    },
  ];

  const gaps = await analyzeContentGaps({
    business: testBusiness,
    competitors: testCompetitors,
    serpQueries: ['emergency dentist Austin', 'invisalign Austin TX', 'dental implants Austin'],
    apiKey: env.GROQ_API_KEY,
  });

  console.log(`   Identified ${gaps.length} content gaps:`);
  for (const g of gaps.slice(0, 3)) {
    console.log(`   - [${g.priority}] ${g.topic} (${g.recommendedPageType} page, intent: ${g.targetIntent})`);
    console.log(`     Title: "${g.suggestedTitle}"`);
    console.log(`     Headings (${g.suggestedHeadings.length}): ${g.suggestedHeadings.slice(0, 2).join(' | ')}`);
  }

  if (gaps.length === 0 || !gaps[0].suggestedTitle || !gaps[0].priority) {
    throw new Error('Content Gap agent failed to generate structured gap recommendations');
  }
  console.log('✅ Content Gap Agent verified.');

  // 2. Test Competitor Messaging Analysis Agent
  console.log('\n2️⃣ Testing Competitor Messaging Analysis Agent...');
  const messaging = await analyzeCompetitorMessaging({
    business: testBusiness,
    competitorData: testCompetitors,
    apiKey: env.GROQ_API_KEY,
  });

  console.log(`   Analyzed ${messaging.competitors.length} competitor positioning profiles.`);
  console.log(`   Found ${messaging.marketPatterns.length} market patterns.`);
  if (messaging.marketPatterns.length > 0) {
    const firstPattern = messaging.marketPatterns[0];
    console.log(`   Pattern #1: "${firstPattern.pattern}"`);
    console.log(`     Observed Facts: ${JSON.stringify(firstPattern.observedFacts)}`);
    console.log(`     AI Interpretation: "${firstPattern.aiInterpretation}"`);
    console.log(`     Recommended Action: "${firstPattern.recommendedAction}"`);

    if (!firstPattern.observedFacts || !firstPattern.aiInterpretation || !firstPattern.recommendedAction) {
      throw new Error('Messaging analysis must separate observed facts, interpretation, and action');
    }
  }
  console.log('✅ Competitor Messaging Analysis Agent verified.');

  // 3. Test Customer Review (VoC) Analysis Agent
  console.log('\n3️⃣ Testing Customer Review Analysis Agent...');
  const sampleReviews = [
    {
      competitorName: 'Apex Dental Care',
      snippet: 'Dr. Apex was remarkably gentle with my severe dental phobia. First time I had a cavity filled with zero pain.',
      rating: 5,
    },
    {
      competitorName: 'Apex Dental Care',
      snippet: 'Waited 45 minutes in the lobby past my appointment time. Great care once seated, but front desk was unorganized.',
      rating: 3,
    },
    {
      competitorName: 'South Congress Dental',
      snippet: 'Upfront prices and zero hidden fees. They printed the exact insurance breakdown before touching a tooth.',
      rating: 5,
    },
  ];

  const reviewVoC = await analyzeCustomerReviews({
    business: testBusiness,
    reviews: sampleReviews,
    apiKey: env.GROQ_API_KEY,
  });

  console.log(`   Extracted ${reviewVoC.themes.length} review themes.`);
  console.log(`   Praise themes: ${reviewVoC.commonPraise.join(', ')}`);
  console.log(`   Complaint themes: ${reviewVoC.commonComplaints.join(', ')}`);
  console.log(`   Website Copy Opportunities (${reviewVoC.websiteCopyOpportunities.length}):`);
  for (const op of reviewVoC.websiteCopyOpportunities.slice(0, 2)) {
    console.log(`   - Headline: "${op.suggestedCopyHeadline}" (Vocab: "${op.customerQuoteOrVocabulary}", Target: ${op.targetPage})`);
  }

  if (reviewVoC.themes.length === 0 || reviewVoC.websiteCopyOpportunities.length === 0) {
    throw new Error('Review VoC agent failed to extract themes or copy opportunities');
  }
  console.log('✅ Customer Review Analysis Agent verified.');

  // 4. Test Google News Signals Agent
  console.log('\n4️⃣ Testing Google News Monitor Agent...');
  const newsSignals = await analyzeNewsSignals({
    business: testBusiness,
    articles: [
      {
        title: 'Austin Tech Corridor Population Surge Drives High Demand for Healthcare Providers',
        source: 'Austin Business Journal',
        url: 'https://example.com/austin-population-surge',
        snippet: 'Thousands of new tech employees relocating to Austin are searching for local dentists with digital booking.',
        date: '2026-09-15',
      },
      {
        title: 'Texas Board of Dental Examiners Updates Teledentistry Regulations',
        source: 'Texas Tribune',
        url: 'https://example.com/teledentistry-rules',
        snippet: 'New guidelines clarify insurance coverage for virtual consultations across Central Texas clinics.',
        date: '2026-09-18',
      },
    ],
    apiKey: env.GROQ_API_KEY,
  });

  console.log(`   Classified ${newsSignals.length} news signals:`);
  for (const s of newsSignals) {
    console.log(`   - [${s.category.toUpperCase()}] "${s.headline}"`);
    console.log(`     Summary: ${s.summary}`);
  }

  if (newsSignals.length !== 2 || !newsSignals[0].category) {
    throw new Error('News signals agent failed to classify articles');
  }
  console.log('✅ Google News Monitor Agent verified.');

  // 5. Test SERP Change Detector
  console.log('\n5️⃣ Testing SERP Change Detector...');
  const prevRun = [
    { rank: 1, domain: 'apexdental.example.com', url: 'https://apexdental.example.com', title: 'Apex Dental' },
    { rank: 2, domain: 'socodental.example.com', url: 'https://socodental.example.com', title: 'SoCo Dental' },
    { rank: 3, domain: 'austinmoderndentistry.example.com', url: 'https://austinmoderndentistry.example.com', title: 'Austin Modern Dentistry' },
    { rank: 4, domain: 'yelp.com', url: 'https://yelp.com/austin-dentists', title: 'Yelp' },
  ];

  const currRun = [
    { rank: 1, domain: 'austinmoderndentistry.example.com', url: 'https://austinmoderndentistry.example.com', title: 'Austin Modern Dentistry' }, // climbed +2
    { rank: 2, domain: 'apexdental.example.com', url: 'https://apexdental.example.com', title: 'Apex Dental' }, // dropped -1
    { rank: 3, domain: 'newrival.example.com', url: 'https://newrival.example.com', title: 'New Rival Dental' }, // new entrant
    { rank: 4, domain: 'socodental.example.com', url: 'https://socodental.example.com', title: 'SoCo Dental' }, // dropped -2
  ];

  const changeDiff = detectSearchRunChanges({
    query: 'best dentist austin tx',
    userDomain: 'austinmoderndentistry.example.com',
    previousResults: prevRun,
    currentResults: currRun,
  });

  console.log(`   Change Detection Summary: "${changeDiff.summary}"`);
  console.log(`   Rank Shifts (${changeDiff.rankShifts.length}):`);
  for (const s of changeDiff.rankShifts) {
    console.log(`   - ${s.domain}: #${s.previousRank} -> #${s.currentRank} (Delta: ${s.delta > 0 ? '+' + s.delta : s.delta})`);
  }
  console.log(`   New Top 10 Entrants: ${changeDiff.newEntrants.map((e) => e.domain).join(', ')}`);

  const userShift = changeDiff.rankShifts.find((s) => s.domain.includes('austinmoderndentistry'));
  if (!userShift || userShift.delta !== 2) {
    throw new Error('Change detector failed to compute correct rank shift delta (+2)');
  }
  if (changeDiff.newEntrants.length !== 1 || changeDiff.newEntrants[0].domain !== 'newrival.example.com') {
    throw new Error('Change detector missed new top 10 entrant');
  }
  console.log('✅ SERP Change Detector verified.');

  // 6. Database Persistence & Update verification
  console.log('\n6️⃣ Testing Database Persistence for Content Gaps & Review Themes...');
  const testUserId = 'test_analysis_user_' + Math.random().toString(36).substring(2, 7);

  const [testWs] = await db
    .insert(workspaces)
    .values({
      name: 'Analysis Test Workspace',
      ownerId: testUserId,
    })
    .returning();

  const [testBiz] = await db
    .insert(businesses)
    .values({
      workspaceId: testWs.id,
      name: 'Austin Modern Dentistry',
      websiteUrl: 'https://austinmoderndentistry.example.com',
      city: 'Austin',
    })
    .returning();

  const [createdGap] = await db
    .insert(contentGaps)
    .values({
      businessId: testBiz.id,
      topic: gaps[0].topic,
      recommendedPageType: gaps[0].recommendedPageType,
      suggestedTitle: gaps[0].suggestedTitle,
      suggestedHeadings: gaps[0].suggestedHeadings,
      suggestedFaqs: gaps[0].suggestedFaqs,
      targetIntent: gaps[0].targetIntent,
      priority: gaps[0].priority,
      effort: gaps[0].estimatedEffort,
      impact: gaps[0].estimatedImpact,
      status: 'open',
    })
    .returning();

  console.log(`✅ Persisted Content Gap "${createdGap.topic}" (ID: ${createdGap.id}, Priority: ${createdGap.priority})`);

  // Update status to 'in_progress'
  const [updatedGap] = await db
    .update(contentGaps)
    .set({ status: 'in_progress' })
    .where(eq(contentGaps.id, createdGap.id))
    .returning();

  if (updatedGap.status !== 'in_progress') {
    throw new Error('Failed to update content gap status');
  }

  // Persist Review Theme
  const [createdTheme] = await db
    .insert(reviewThemes)
    .values({
      theme: reviewVoC.themes[0].theme,
      sentiment: reviewVoC.themes[0].sentiment,
      frequency: reviewVoC.themes[0].frequency,
      examples: reviewVoC.themes[0].examples,
      sourceReference: 'Apex Dental Reviews',
    })
    .returning();

  console.log(`✅ Persisted Review Theme "${createdTheme.theme}" (Sentiment: ${createdTheme.sentiment})`);

  // Cleanup test workspace
  await db.delete(workspaces).where(eq(workspaces.id, testWs.id));
  console.log('✅ Cleaned up test database resources.');

  console.log('\n🎉 ALL MILESTONE 6 VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉');
}

main().catch((err) => {
  console.error('\n❌ Milestone 6 verification failed:', err);
  process.exit(1);
});
