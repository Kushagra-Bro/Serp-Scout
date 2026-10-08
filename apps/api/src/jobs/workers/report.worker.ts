import { Worker, Job } from 'bullmq';
import { eq, desc } from 'drizzle-orm';
import {
  db,
  businesses,
  workspaces,
  services,
  keywords,
  rankingObservations,
  contentGaps,
  reports,
  recommendations,
  sourceEvidence,
  competitors,
} from '../../db/index.js';
import {
  generateWeeklyReport,
} from '@serp-scout/agents';
import { generateReportPdf } from '../../services/pdf.service.js';
import { buildDetailedReport } from '../../services/report-bundle.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { redisConnection } from '../queues.js';

export interface ReportJobData {
  businessId: string;
  workspaceId: string;
  recipientEmail?: string;
}

export async function executeReportGeneration(data: ReportJobData) {
  const { businessId, workspaceId } = data;
  console.log(`[ReportWorker] Starting report generation for businessId: ${businessId}`);

  // 1. Fetch business & workspace
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) {
    throw new Error(`Business ${businessId} not found`);
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  // 2. Fetch business services
  const bizServices = await db
    .select()
    .from(services)
    .where(eq(services.businessId, businessId));
  const serviceNames = bizServices.length > 0 ? bizServices.map((s) => s.name) : ['General Services'];

  // 3. Fetch tracked keywords and competitor benchmarks.
  //    (The ranking history itself is assembled in step 5 from the business's own
  //    positions per check — see buildDetailedReport.)
  const trackedKeywords = await db
    .select()
    .from(keywords)
    .where(eq(keywords.businessId, businessId));

  // Fetch real competitor data for benchmarking
  const competitorList = await db
    .select()
    .from(competitors)
    .where(eq(competitors.businessId, businessId));

  // 4. Fetch content gaps
  const existingGaps = await db
    .select()
    .from(contentGaps)
    .where(eq(contentGaps.businessId, businessId))
    .limit(5);

  const mappedGaps = existingGaps.map((g) => {
    // Find the real competitor that owns this content gap
    const gapCompetitor = competitorList.find(
      (c) => g.competitorId === c.id || (c.metadata as any)?.contentGapTopics?.includes(g.topic)
    );

    return {
      topic: g.topic,
      competitorDomain: gapCompetitor?.domain || '',
      competitorUrl: gapCompetitor?.domain ? `https://${gapCompetitor.domain}` : '',
      recommendedPageType: (g.recommendedPageType as any) || 'service',
      suggestedTitle: g.suggestedTitle || g.topic,
      suggestedHeadings: (g.suggestedHeadings as string[]) || ['Overview', 'Pricing'],
      suggestedFaqs: (g.suggestedFaqs as string[]) || ['How does this work?'],
      targetIntent: (g.targetIntent as any) || 'commercial',
      estimatedImpact: (g.impact as any) || 'high',
      estimatedEffort: (g.effort as any) || 'medium',
      priority: (g.priority as any) || 'P1',
      evidenceUrls: gapCompetitor?.domain ? [`https://${gapCompetitor.domain}`] : [],
    };
  });

  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const periodEnd = new Date();

  // 5. Assemble the detailed report material first: the ranking section must be
  //    built from the business's own positions per check. Reading the two newest
  //    ranking_observations rows directly (as this worker used to) mixed
  //    competitor rows into the business's previous rank and produced nothing at
  //    all for keywords where the business does not rank.
  const detailedSections = await buildDetailedReport({
    businessId,
    periodStart,
    periodEnd,
  });

  const allShiftRows = [
    ...detailedSections.rankingShifts.movers,
    ...detailedSections.rankingShifts.unchanged,
    ...detailedSections.rankingShifts.newEntries,
    ...detailedSections.rankingShifts.droppedOut,
    ...detailedSections.rankingShifts.notRanking,
  ];

  const rankingChanges = allShiftRows.map((row) => ({
    phrase: row.keyword,
    currentRank: row.currentRank,
    previousRank: row.previousRank,
    delta: row.shift,
    bestCompetitorRank: row.bestCompetitorRank,
    bestCompetitorDomain: row.bestCompetitorDomain,
  }));

  // 6. Generate structured report document with prioritized 3-5 actions
  const generatedReport = await generateWeeklyReport({
    business: {
      name: business.name,
      websiteUrl: business.websiteUrl,
      services: serviceNames,
      city: business.city || undefined,
    },
    keywordRankings: rankingChanges,
    contentGaps: detailedSections.actions.length >= 0 ? mappedGaps : mappedGaps,
    competitorChanges: detailedSections.competitors.slice(0, 5).map((c) => {
      const bits = [`${c.name} (${c.domain})`, `type ${c.competitorType}`, `${c.confidenceScore}% match`];
      if (c.threatLevel) bits.push(`${c.threatLevel} threat`);
      if (c.reviewCount !== null) bits.push(`${c.reviewCount} reviews`);
      if (c.rating !== null) bits.push(`${c.rating.toFixed(1)}★`);
      return bits.join(' · ');
    }),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });

  // Attach the detailed sections (KPI dashboard, ranking shifts, competitor
  // landscape, reputation, local presence, evidence, methodology).
  const reportSummary = {
    ...generatedReport,
    detailed: {
      ...detailedSections,
      actions: generatedReport.actionPlan.length > 0 ? generatedReport.actionPlan : detailedSections.actions,
    },
  };

  // 7. Save report in Neon DB
  const [newReport] = await db
    .insert(reports)
    .values({
      businessId,
      periodStart,
      periodEnd,
      summary: reportSummary as any,
      status: 'published',
      generatedAt: new Date(),
    })
    .returning();

  // 8. Save recommendations & evidence
  const savedRecs: Array<{ id: string; title: string }> = [];
  for (const action of generatedReport.actionPlan) {
    const steps = action.implementationSteps && action.implementationSteps.length > 0
      ? action.implementationSteps
      : [
          `Review competitor positioning on ${action.searchQueries?.[0] || 'target query'}`,
          `Draft and publish targeted copy addressing core consumer friction`,
          `Add LocalBusiness schema markup and request Google indexing`,
        ];

    const [rec] = await db
      .insert(recommendations)
      .values({
        businessId,
        reportId: newReport.id,
        title: action.title,
        description: action.problem,
        impact: action.expectedImpact,
        effort: action.estimatedEffort,
        priority: action.priority,
        confidence: action.confidence,
        status: 'planned',
        checklist: {
          steps,
          completed: steps.map(() => false),
        },
        dueDate:
          action.suggestedDeadline && !isNaN(new Date(action.suggestedDeadline).getTime())
            ? new Date(action.suggestedDeadline)
            : undefined,
      })
      .returning();

    const urls = action.sourceUrls && action.sourceUrls.length > 0 ? action.sourceUrls : [business.websiteUrl];
    for (const url of urls) {
      await db.insert(sourceEvidence).values({
        businessId,
        recommendationId: rec.id,
        sourceUrl: url,
        sourceTitle: action.searchQueries?.[0] ? `Query: ${action.searchQueries[0]}` : 'Source Evidence',
        claim: action.evidenceSummary || action.title,
        collectedAt: new Date(),
      });
    }
  }

  // 9. Generate the PDF preview from the detailed document (same content the
  //    download endpoint produces, so the emailed and downloaded reports match).
  try {
    const pdfBuffer = await generateReportPdf({
      businessName: business.name,
      websiteUrl: business.websiteUrl,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      report: reportSummary as any,
    });
    console.log(`[ReportWorker] Generated PDF report: ${pdfBuffer.length} bytes.`);
  } catch (pdfErr) {
    console.warn(`[ReportWorker] PDF generation notice:`, pdfErr);
  }

  // 10. Send email notification via Resend with deduplication
  const recipient = data.recipientEmail || workspace?.notificationEmail || 'owner@example.com';
  console.log(`[ReportWorker] Triggering report notification to ${recipient}...`);
  const notificationResult = await NotificationService.sendWeeklyReportNotification({
    workspaceId,
    businessId,
    businessName: business.name,
    reportId: newReport.id,
    recipientEmail: recipient,
    report: generatedReport,
  });

  console.log(`[ReportWorker] Report generated and notification processed:`, notificationResult);

  return {
    reportId: newReport.id,
    actionCount: generatedReport.actionPlan.length,
    kpis: reportSummary.detailed.kpis,
    rankingShiftRows: allShiftRows.length,
    notification: notificationResult,
  };
}

/**
 * Legacy starter maintained for backwards compatibility.
 * All workloads are now managed by startMainJobWorker() in main.worker.ts.
 */
export function startReportWorker() {
  return { close: async () => {} };
}
