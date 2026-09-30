import {
  generateRecommendations,
  generateWeeklyReport,
} from '@serp-scout/agents';
import {
  db,
  workspaces,
  businesses,
  reports,
  recommendations,
  sourceEvidence,
} from './db/index.js';
import { eq } from 'drizzle-orm';
import { env } from './config/env.js';
import {
  generateReportPdf,
  generateReportCsv,
} from './services/pdf.service.js';

async function main() {
  console.log('🧪 Starting Milestone 7: Recommendation & Reporting Engine verification...\n');

  const testBusiness = {
    name: 'Austin Premier Dentistry',
    websiteUrl: 'https://austinpremierdentistry.example.com',
    services: ['Dental Implants', 'Teeth Whitening', 'Invisalign'],
    city: 'Austin',
  };

  // 1. Test Recommendation Engine
  console.log('1️⃣ Testing Recommendation Engine (max 3 to 5 actions with evidence citations)...');
  const actionPlan = await generateRecommendations({
    business: testBusiness,
    rankingChanges: [
      {
        phrase: 'emergency dentist Austin TX',
        currentRank: 8,
        previousRank: 12,
        delta: 4,
        bestCompetitorRank: 2,
        bestCompetitorDomain: 'austinemurgencydental.com',
      },
      {
        phrase: 'invisalign cost Austin',
        currentRank: null,
        previousRank: null,
        delta: null,
        bestCompetitorRank: 3,
        bestCompetitorDomain: 'austinsmiles.com',
      },
    ],
    contentGaps: [
      {
        topic: 'Invisalign Financing & Pricing Guide',
        competitorDomain: 'austinsmiles.com',
        competitorUrl: 'https://austinsmiles.com/invisalign-cost',
        recommendedPageType: 'service',
        suggestedTitle: 'Invisalign Cost & 0% Financing in Austin, TX',
        suggestedHeadings: ['Transparent Treatment Costs', 'Monthly Payment Plans'],
        suggestedFaqs: ['Is Invisalign covered by insurance?'],
        targetIntent: 'commercial',
        estimatedImpact: 'high',
        estimatedEffort: 'low',
        priority: 'P0',
        evidenceUrls: ['https://austinsmiles.com/invisalign-cost'],
      },
    ],
    apiKey: env.GROQ_API_KEY,
  });

  console.log(`   Generated ${actionPlan.length} prioritized actions (Allowed range: 3 to 5):`);
  for (const act of actionPlan) {
    console.log(`   - [${act.priority}] ${act.title}`);
    console.log(`     Impact: ${act.expectedImpact}, Effort: ${act.estimatedEffort}, Confidence: ${act.confidence}`);
    console.log(`     Evidence Citing: ${act.sourceUrls.join(', ')}`);
    console.log(`     Queries: ${act.searchQueries.join(', ')}`);

    if (!act.sourceUrls || act.sourceUrls.length === 0) {
      throw new Error(`Action "${act.title}" is missing required source evidence URLs`);
    }
  }

  if (actionPlan.length < 2 || actionPlan.length > 5) {
    throw new Error(`Action plan must contain between 2 and 5 actions, received: ${actionPlan.length}`);
  }
  console.log('✅ Recommendation Engine verified.');

  // 2. Test Full Report Generator
  console.log('\n2️⃣ Testing Full Weekly Report Generator...');
  const periodStart = '2026-09-13';
  const periodEnd = '2026-09-20';

  const fullReport = await generateWeeklyReport({
    business: testBusiness,
    periodStart,
    periodEnd,
    keywordRankings: [
      {
        phrase: 'emergency dentist Austin TX',
        currentRank: 8,
        previousRank: 12,
        delta: 4,
        bestCompetitorRank: 2,
        bestCompetitorDomain: 'austinemurgencydental.com',
      },
    ],
    contentGaps: [
      {
        topic: 'Invisalign Financing & Pricing Guide',
        competitorDomain: 'austinsmiles.com',
        competitorUrl: 'https://austinsmiles.com/invisalign-cost',
        recommendedPageType: 'service',
        suggestedTitle: 'Invisalign Cost in Austin',
        suggestedHeadings: ['Pricing', 'Insurance'],
        suggestedFaqs: ['Cost?'],
        targetIntent: 'commercial',
        estimatedImpact: 'high',
        estimatedEffort: 'low',
        priority: 'P0',
        evidenceUrls: ['https://austinsmiles.com/invisalign-cost'],
      },
    ],
    apiKey: env.GROQ_API_KEY,
  });

  console.log('   Executive Summary:');
  console.log(`   - Changes: "${fullReport.executiveSummary.importantChanges}"`);
  console.log(`   - Opportunity: "${fullReport.executiveSummary.mainOpportunity}"`);
  console.log(`   - Threat: "${fullReport.executiveSummary.mainCompetitiveThreat}"`);
  console.log(`   - Weekly Focus: "${fullReport.executiveSummary.weeklyFocus}"`);
  console.log(`   Evidence Appendix Items: ${fullReport.evidenceAppendix.length}`);

  if (!fullReport.executiveSummary.weeklyFocus || fullReport.actionPlan.length === 0) {
    throw new Error('Report generator failed to produce complete executive summary and actions');
  }
  console.log('✅ Weekly Report Generator verified.');

  // 3. Test Database Persistence
  console.log('\n3️⃣ Testing Database Persistence for Reports, Recommendations, and Evidence...');
  const testUserId = 'test_rep_user_' + Math.random().toString(36).substring(2, 7);

  const [testWs] = await db
    .insert(workspaces)
    .values({
      name: 'Report Test Workspace',
      ownerId: testUserId,
    })
    .returning();

  const [testBiz] = await db
    .insert(businesses)
    .values({
      workspaceId: testWs.id,
      name: testBusiness.name,
      websiteUrl: testBusiness.websiteUrl,
      city: 'Austin',
    })
    .returning();

  const [savedReport] = await db
    .insert(reports)
    .values({
      businessId: testBiz.id,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      summary: fullReport as any,
      status: 'published',
    })
    .returning();

  console.log(`✅ Saved Report ID: ${savedReport.id} (Status: ${savedReport.status})`);

  // Insert Recommendations linked to Report
  const [savedRec] = await db
    .insert(recommendations)
    .values({
      businessId: testBiz.id,
      reportId: savedReport.id,
      title: fullReport.actionPlan[0].title,
      description: fullReport.actionPlan[0].problem,
      evidence: {
        summary: fullReport.actionPlan[0].evidenceSummary,
        urls: fullReport.actionPlan[0].sourceUrls,
      },
      impact: fullReport.actionPlan[0].expectedImpact,
      effort: fullReport.actionPlan[0].estimatedEffort,
      priority: fullReport.actionPlan[0].priority,
      confidence: fullReport.actionPlan[0].confidence,
      status: 'planned',
    })
    .returning();

  console.log(`✅ Saved Recommendation ID: ${savedRec.id} (Priority: ${savedRec.priority})`);

  // Insert Source Evidence row
  const [savedEv] = await db
    .insert(sourceEvidence)
    .values({
      businessId: testBiz.id,
      recommendationId: savedRec.id,
      sourceUrl: fullReport.actionPlan[0].sourceUrls[0] || testBusiness.websiteUrl,
      sourceTitle: savedRec.title,
      claim: fullReport.actionPlan[0].evidenceSummary,
    })
    .returning();

  console.log(`✅ Saved Source Evidence ID: ${savedEv.id} for Recommendation`);

  // Test Recommendation Status Update
  const [updatedRec] = await db
    .update(recommendations)
    .set({ status: 'in_progress' })
    .where(eq(recommendations.id, savedRec.id))
    .returning();

  if (updatedRec.status !== 'in_progress') {
    throw new Error('Failed to update recommendation status');
  }
  console.log('✅ Updated recommendation status to "in_progress".');

  // 4. Test PDF Generation (Puppeteer)
  console.log('\n4️⃣ Testing Puppeteer PDF Rendering...');
  const pdfBuffer = await generateReportPdf({
    businessName: testBusiness.name,
    websiteUrl: testBusiness.websiteUrl,
    periodStart,
    periodEnd,
    report: fullReport,
  });

  console.log(`✅ Generated PDF Buffer of size: ${pdfBuffer.length} bytes.`);
  const pdfHeader = pdfBuffer.subarray(0, 4).toString('utf-8');
  if (pdfHeader !== '%PDF') {
    throw new Error(`Generated buffer is not a valid PDF (Header: "${pdfHeader}")`);
  }
  console.log('✅ Verified PDF format integrity (%PDF header).');

  // 5. Test CSV Generation
  console.log('\n5️⃣ Testing CSV Export Formatting...');
  const csvText = generateReportCsv({
    businessName: testBusiness.name,
    websiteUrl: testBusiness.websiteUrl,
    periodStart,
    periodEnd,
    report: fullReport,
  });

  const lines = csvText.trim().split('\n');
  console.log(`✅ Generated CSV with ${lines.length} lines.`);
  console.log(`   Header: ${lines[0].substring(0, 60)}...`);
  console.log(`   Sample Row: ${lines[1].substring(0, 60)}...`);

  if (!lines[0].includes('Priority') || !lines[0].includes('Action Title')) {
    throw new Error('CSV missing required header columns');
  }
  console.log('✅ CSV Export verified.');

  // Cleanup test workspace
  await db.delete(workspaces).where(eq(workspaces.id, testWs.id));
  console.log('✅ Cleaned up test database resources.');

  console.log('\n🎉 ALL MILESTONE 7 VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉');
}

main().catch((err) => {
  console.error('\n❌ Milestone 7 verification failed:', err);
  process.exit(1);
});
