import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, gte } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import {
  db,
  businesses,
  reports,
  recommendations,
  sourceEvidence,
  contentGaps,
  keywords,
  rankingObservations,
  reportShares,
  marketAlerts,
} from '../db/index.js';
import { WorkspaceRequest } from '../middleware/workspace.js';
import { generateWeeklyReport } from '@serp-scout/agents';
import {
  generateReportPdf,
  generateReportCsv,
  ReportPdfData,
} from '../services/pdf.service.js';
import { getRankingsForBusiness } from '../services/ranking.service.js';
import { MarketShiftService } from '../services/market-shift.service.js';
import { env } from '../config/env.js';
import { GeneratedReport } from '@serp-scout/types';

const router = Router();

const updateRecStatusSchema = z.object({
  status: z.enum(['planned', 'in_progress', 'completed', 'dismissed']),
});

// POST /api/businesses/:id/reports/generate - Generate fresh report
router.post(
  '/:id/reports/generate',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      // 1. Fetch business & context
      const [biz] = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!biz) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Business not found' },
        });
        return;
      }

      // Fetch rankings
      const keywordRankings = await getRankingsForBusiness(businessId);

      // Fetch content gaps
      const gaps = await db
        .select()
        .from(contentGaps)
        .where(eq(contentGaps.businessId, businessId))
        .limit(10);

      const periodEnd = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const periodStart = weekAgo.toISOString().split('T')[0];

      // 2. Generate Report via Engine
      const generated = await generateWeeklyReport({
        business: {
          name: biz.name,
          websiteUrl: biz.websiteUrl,
          services: [],
          city: biz.city || undefined,
        },
        periodStart,
        periodEnd,
        keywordRankings: keywordRankings.map((k) => ({
          phrase: k.keyword.phrase,
          currentRank: k.currentRank,
          previousRank: k.previousRank,
          delta: k.delta,
          bestCompetitorRank: k.bestCompetitorRank,
          bestCompetitorDomain: k.bestCompetitorDomain,
        })),
        contentGaps: gaps.map((g) => ({
          topic: g.topic,
          competitorDomain: (g.evidence as any)?.competitorDomain || 'rival.com',
          competitorUrl: (g.evidence as any)?.competitorUrl || 'https://rival.com',
          recommendedPageType: (g.recommendedPageType as any) || 'service',
          suggestedTitle: g.suggestedTitle || g.topic,
          suggestedHeadings: (g.suggestedHeadings as string[]) || [],
          suggestedFaqs: (g.suggestedFaqs as string[]) || [],
          targetIntent: (g.targetIntent as any) || 'commercial',
          estimatedImpact: (g.impact as any) || 'medium',
          estimatedEffort: (g.effort as any) || 'medium',
          priority: (g.priority as any) || 'P1',
          evidenceUrls: (g.evidence as any)?.evidenceUrls || [],
        })),
        apiKey: env.GROQ_API_KEY,
      });

      // 3. Persist Report in Neon
      const [newReport] = await db
        .insert(reports)
        .values({
          businessId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          summary: generated as any,
          status: 'published',
        })
        .returning();

      // 4. Persist Recommendations and Source Evidence
      const savedRecs = [];
      for (const rec of generated.actionPlan) {
        const steps = rec.implementationSteps && rec.implementationSteps.length > 0
          ? rec.implementationSteps
          : [
              `Review competitor positioning on ${rec.searchQueries?.[0] || 'target query'}`,
              `Draft and publish targeted copy addressing core consumer friction`,
              `Add LocalBusiness schema markup and request Google indexing`,
            ];

        const [savedRec] = await db
          .insert(recommendations)
          .values({
            businessId,
            reportId: newReport.id,
            title: rec.title,
            description: rec.problem,
            evidence: {
              summary: rec.evidenceSummary,
              queries: rec.searchQueries,
              urls: rec.sourceUrls,
            },
            impact: rec.expectedImpact,
            effort: rec.estimatedEffort,
            priority: rec.priority,
            confidence: rec.confidence,
            status: 'planned',
            checklist: {
              steps,
              completed: steps.map(() => false),
            },
          })
          .returning();

        savedRecs.push(savedRec);

        // Insert Source Evidence rows
        for (const url of rec.sourceUrls) {
          await db.insert(sourceEvidence).values({
            businessId,
            recommendationId: savedRec.id,
            sourceUrl: url,
            sourceTitle: rec.title,
            claim: rec.evidenceSummary,
          });
        }
      }

      res.status(201).json({
        success: true,
        data: {
          report: newReport,
          recommendations: savedRecs,
        },
      });
    } catch (err: any) {
      console.error('Report generation failed:', err);
      res.status(500).json({
        success: false,
        error: { code: 'REPORT_GENERATION_FAILED', message: err.message || 'Failed to generate report' },
      });
    }
  }
);

// GET /api/businesses/:id/reports - List reports
router.get(
  '/:id/reports',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [biz] = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!biz) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Business not found' },
        });
        return;
      }

      const list = await db
        .select()
        .from(reports)
        .where(eq(reports.businessId, businessId))
        .orderBy(desc(reports.generatedAt));

      res.json({
        success: true,
        data: list,
      });
    } catch (err: any) {
      console.error(`Failed to list reports for ${businessId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch reports' },
      });
    }
  }
);

// GET /api/reports/:id - Get report details
router.get(
  '/:id',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const reportId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [existing] = await db
        .select({
          report: reports,
          business: businesses,
        })
        .from(reports)
        .innerJoin(businesses, eq(reports.businessId, businesses.id))
        .where(and(eq(reports.id, reportId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report not found' },
        });
        return;
      }

      // Fetch recommendations
      const recs = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.reportId, reportId))
        .orderBy(recommendations.priority);

      // Fetch evidence
      const recIds = recs.map((r) => r.id);
      let evidenceList: any[] = [];
      if (recIds.length > 0) {
        evidenceList = await db
          .select()
          .from(sourceEvidence)
          .where(eq(sourceEvidence.businessId, existing.business.id));
      }

      res.json({
        success: true,
        data: {
          report: existing.report,
          business: existing.business,
          recommendations: recs,
          evidence: evidenceList,
        },
      });
    } catch (err: any) {
      console.error(`Failed to fetch report ${reportId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch report' },
      });
    }
  }
);

// GET /api/reports/:id/pdf - Stream PDF binary
router.get(
  '/:id/pdf',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const reportId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [record] = await db
        .select({
          report: reports,
          business: businesses,
        })
        .from(reports)
        .innerJoin(businesses, eq(reports.businessId, businesses.id))
        .where(and(eq(reports.id, reportId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!record) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report not found' },
        });
        return;
      }

      const rawSummary = (record.report.summary as any) || {};

      // If actionPlan is missing or empty, hydrate from database recommendations
      let actionPlan = Array.isArray(rawSummary.actionPlan) ? rawSummary.actionPlan : [];
      if (actionPlan.length === 0) {
        const recs = await db
          .select()
          .from(recommendations)
          .where(eq(recommendations.reportId, reportId))
          .orderBy(recommendations.priority);

        actionPlan = recs.map((r) => ({
          title: r.title,
          problem: r.description,
          evidenceSummary: (r.evidence as any)?.summary || r.description,
          priority: (r.priority as any) || 'P1',
          expectedImpact: (r.impact as any) || 'medium',
          estimatedEffort: (r.effort as any) || 'medium',
          confidence: (r.confidence as any) || 'high',
          suggestedOwner: 'Practice Lead',
          suggestedDeadline: 'Within 7 days',
          searchQueries: (r.evidence as any)?.queries || [],
          sourceUrls: (r.evidence as any)?.urls || [],
          implementationSteps: [],
        }));
      }

      const reportData: ReportPdfData = {
        businessName: record.business.name,
        websiteUrl: record.business.websiteUrl,
        periodStart: record.report.periodStart.toISOString().split('T')[0],
        periodEnd: record.report.periodEnd.toISOString().split('T')[0],
        report: {
          ...rawSummary,
          actionPlan,
        },
      };

      const pdfBuffer = await generateReportPdf(reportData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="serp-scout-report-${reportData.periodEnd}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error(`PDF generation failed for ${reportId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'PDF_FAILED', message: err.message || 'Failed to render PDF' },
      });
    }
  }
);

// GET /api/reports/:id/csv - Stream CSV export
router.get(
  '/:id/csv',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const reportId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [record] = await db
        .select({
          report: reports,
          business: businesses,
        })
        .from(reports)
        .innerJoin(businesses, eq(reports.businessId, businesses.id))
        .where(and(eq(reports.id, reportId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!record) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report not found' },
        });
        return;
      }

      const rawSummary = (record.report.summary as any) || {};

      let actionPlan = Array.isArray(rawSummary.actionPlan) ? rawSummary.actionPlan : [];
      if (actionPlan.length === 0) {
        const recs = await db
          .select()
          .from(recommendations)
          .where(eq(recommendations.reportId, reportId))
          .orderBy(recommendations.priority);

        actionPlan = recs.map((r) => ({
          title: r.title,
          problem: r.description,
          evidenceSummary: (r.evidence as any)?.summary || r.description,
          priority: (r.priority as any) || 'P1',
          expectedImpact: (r.impact as any) || 'medium',
          estimatedEffort: (r.effort as any) || 'medium',
          confidence: (r.confidence as any) || 'high',
          suggestedOwner: 'Practice Lead',
          suggestedDeadline: 'Within 7 days',
          searchQueries: (r.evidence as any)?.queries || [],
          sourceUrls: (r.evidence as any)?.urls || [],
          implementationSteps: [],
        }));
      }

      const csvContent = generateReportCsv({
        businessName: record.business.name,
        websiteUrl: record.business.websiteUrl,
        periodStart: record.report.periodStart.toISOString().split('T')[0],
        periodEnd: record.report.periodEnd.toISOString().split('T')[0],
        report: {
          ...rawSummary,
          actionPlan,
        },
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="serp-scout-actions-${record.report.periodEnd.toISOString().split('T')[0]}.csv"`
      );
      res.send(csvContent);
    } catch (err: any) {
      console.error(`CSV generation failed for ${reportId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'CSV_FAILED', message: err.message || 'Failed to generate CSV' },
      });
    }
  }
);

// PATCH /api/recommendations/:id - Update recommendation status
router.patch(
  ['/recommendations/:id', '/:id'],
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const recId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    const parseResult = updateRecStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid status' },
      });
      return;
    }

    try {
      const [existing] = await db
        .select({
          rec: recommendations,
        })
        .from(recommendations)
        .innerJoin(businesses, eq(recommendations.businessId, businesses.id))
        .where(and(eq(recommendations.id, recId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Recommendation not found' },
        });
        return;
      }

      const [updated] = await db
        .update(recommendations)
        .set({ status: parseResult.data.status })
        .where(eq(recommendations.id, recId))
        .returning();

      res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error(`Failed to update recommendation ${recId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update recommendation' },
      });
    }
  }
);

// PATCH /api/recommendations/:id/checklist - Toggle sub-task completion
const checklistToggleSchema = z.object({
  stepIndex: z.number().int().min(0),
  completed: z.boolean(),
});

router.patch(
  ['/recommendations/:id/checklist', '/:id/checklist'],
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const recId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    const parseResult = checklistToggleSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid checklist toggle parameters' },
      });
      return;
    }

    try {
      const [existing] = await db
        .select({
          rec: recommendations,
        })
        .from(recommendations)
        .innerJoin(businesses, eq(recommendations.businessId, businesses.id))
        .where(and(eq(recommendations.id, recId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Recommendation not found' },
        });
        return;
      }

      const currentChecklist = (existing.rec.checklist as any) || {
        steps: [
          'Audit current landing copy',
          'Deploy on-page schema and metadata optimization',
          'Verify local citation indexing and ranking impact',
        ],
        completed: [false, false, false],
      };

      const updatedCompleted = Array.isArray(currentChecklist.completed)
        ? [...currentChecklist.completed]
        : [];

      // Ensure length matches steps
      while (updatedCompleted.length < (currentChecklist.steps?.length || 3)) {
        updatedCompleted.push(false);
      }

      const { stepIndex, completed } = parseResult.data;
      if (stepIndex < updatedCompleted.length) {
        updatedCompleted[stepIndex] = completed;
      }

      const updatedChecklist = {
        ...currentChecklist,
        completed: updatedCompleted,
      };

      // Automatically update status to 'in_progress' or 'completed' if all steps are done
      const allDone = updatedCompleted.length > 0 && updatedCompleted.every(Boolean);
      const someDone = updatedCompleted.some(Boolean);
      let nextStatus = existing.rec.status;
      if (allDone) {
        nextStatus = 'completed';
      } else if (someDone && nextStatus === 'planned') {
        nextStatus = 'in_progress';
      }

      const [updated] = await db
        .update(recommendations)
        .set({
          checklist: updatedChecklist,
          status: nextStatus as any,
        })
        .where(eq(recommendations.id, recId))
        .returning();

      res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error(`Failed to update checklist for ${recId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update checklist' },
      });
    }
  }
);

// GET /api/recommendations/:id/outcome - Correlate completed action with ranking outcomes
router.patch;
router.get(
  ['/recommendations/:id/outcome', '/:id/outcome'],
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const recId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [existing] = await db
        .select({
          rec: recommendations,
          business: businesses,
        })
        .from(recommendations)
        .innerJoin(businesses, eq(recommendations.businessId, businesses.id))
        .where(and(eq(recommendations.id, recId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Recommendation not found' },
        });
        return;
      }

      const queries: string[] = (existing.rec.evidence as any)?.queries || [];
      const outcomes: Array<{
        phrase: string;
        currentRank: number | null;
        previousRank: number | null;
        delta: number | null;
        isIn3Pack: boolean;
      }> = [];

      for (const phrase of queries.slice(0, 3)) {
        const [kw] = await db
          .select()
          .from(keywords)
          .where(and(eq(keywords.businessId, existing.business.id), eq(keywords.phrase, phrase)))
          .limit(1);

        if (kw) {
          const obs = await db
            .select()
            .from(rankingObservations)
            .where(eq(rankingObservations.keywordId, kw.id))
            .orderBy(desc(rankingObservations.observedAt))
            .limit(2);

          const current = obs[0]?.rank ?? null;
          const previous = obs[1]?.rank ?? null;
          const delta = current !== null && previous !== null ? previous - current : null;

          outcomes.push({
            phrase,
            currentRank: current,
            previousRank: previous,
            delta,
            isIn3Pack: current !== null && current <= 3,
          });
        }
      }

      // Compute strategic outcome summary
      let outcomeSummary = 'Awaiting next SERP rank sweep to measure ranking delta.';
      const positiveShift = outcomes.find((o) => o.delta && o.delta > 0);
      const in3Pack = outcomes.find((o) => o.isIn3Pack);

      if (positiveShift) {
        outcomeSummary = `Climbed +${positiveShift.delta} spots for "${positiveShift.phrase}" following optimization.`;
      } else if (in3Pack) {
        outcomeSummary = `Active inside Google 3-Pack (Rank #${in3Pack.currentRank}) for "${in3Pack.phrase}".`;
      } else if (existing.rec.status === 'completed') {
        outcomeSummary = 'Implementation completed. Baseline visibility locked for upcoming weekly audit.';
      }

      res.json({
        success: true,
        data: {
          recommendationId: recId,
          status: existing.rec.status,
          outcomes,
          outcomeSummary,
        },
      });
    } catch (err: any) {
      console.error(`Failed to fetch outcome for ${recId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to calculate outcome' },
      });
    }
  }
);

// POST /api/reports/:id/share - Generate or update public share link
const createShareSchema = z.object({
  viewMode: z.enum(['executive', 'specialist']).default('executive'),
  expiresDays: z.number().int().min(1).max(365).optional(),
});

router.post(
  ['/reports/:id/share', '/:id/share'],
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const reportId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    const parseResult = createShareSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid share parameters' },
      });
      return;
    }

    try {
      const [record] = await db
        .select({
          report: reports,
          business: businesses,
        })
        .from(reports)
        .innerJoin(businesses, eq(reports.businessId, businesses.id))
        .where(and(eq(reports.id, reportId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!record) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report not found' },
        });
        return;
      }

      const { viewMode, expiresDays = 30 } = parseResult.data;
      const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
      const shareToken = randomBytes(24).toString('hex');

      // Check if a share link already exists for this report
      const [existingShare] = await db
        .select()
        .from(reportShares)
        .where(eq(reportShares.reportId, reportId))
        .limit(1);

      let savedShare;
      if (existingShare) {
        [savedShare] = await db
          .update(reportShares)
          .set({
            shareToken,
            viewMode,
            expiresAt,
          })
          .where(eq(reportShares.id, existingShare.id))
          .returning();
      } else {
        [savedShare] = await db
          .insert(reportShares)
          .values({
            reportId,
            businessId: record.business.id,
            shareToken,
            viewMode,
            expiresAt,
          })
          .returning();
      }

      const shareUrl = `${env.FRONTEND_URL}/shared/${savedShare.shareToken}`;

      res.status(201).json({
        success: true,
        data: {
          share: savedShare,
          shareUrl,
        },
      });
    } catch (err: any) {
      console.error(`Failed to generate share link for report ${reportId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create share link' },
      });
    }
  }
);

// GET /api/reports/:id/share - Get active share link
router.get(
  ['/reports/:id/share', '/:id/share'],
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const reportId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [record] = await db
        .select({
          report: reports,
          business: businesses,
        })
        .from(reports)
        .innerJoin(businesses, eq(reports.businessId, businesses.id))
        .where(and(eq(reports.id, reportId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!record) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report not found' },
        });
        return;
      }

      const [existingShare] = await db
        .select()
        .from(reportShares)
        .where(eq(reportShares.reportId, reportId))
        .limit(1);

      if (!existingShare) {
        res.json({
          success: true,
          data: null,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          share: existingShare,
          shareUrl: `${env.FRONTEND_URL}/shared/${existingShare.shareToken}`,
          isExpired: existingShare.expiresAt ? new Date(existingShare.expiresAt) < new Date() : false,
        },
      });
    } catch (err: any) {
      console.error(`Failed to get share link for report ${reportId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch share link' },
      });
    }
  }
);

// DELETE /api/reports/:id/share - Revoke share link
router.delete(
  ['/reports/:id/share', '/:id/share'],
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const reportId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [record] = await db
        .select({
          report: reports,
          business: businesses,
        })
        .from(reports)
        .innerJoin(businesses, eq(reports.businessId, businesses.id))
        .where(and(eq(reports.id, reportId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!record) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report not found' },
        });
        return;
      }

      await db.delete(reportShares).where(eq(reportShares.reportId, reportId));

      res.json({
        success: true,
        message: 'Share link revoked successfully',
      });
    } catch (err: any) {
      console.error(`Failed to delete share link for report ${reportId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to revoke share link' },
      });
    }
  }
);

// GET /api/businesses/:id/alerts - Fetch active emergency market alerts
router.get(
  ['/:id/alerts', '/businesses/:id/alerts'],
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [biz] = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!biz) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Business not found' },
        });
        return;
      }

      // Run background market shift analysis to discover new threats
      await MarketShiftService.analyzeBusiness(businessId).catch((err) => {
        console.warn(`[MarketShift] Analysis check warning:`, err);
      });

      const alerts = await MarketShiftService.getActiveAlerts(businessId);

      res.json({
        success: true,
        data: alerts,
      });
    } catch (err: any) {
      console.error(`Failed to fetch alerts for business ${businessId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch market alerts' },
      });
    }
  }
);

// PATCH /api/businesses/:id/alerts/:alertId/dismiss - Dismiss emergency alert
router.patch(
  ['/:id/alerts/:alertId/dismiss', '/businesses/:id/alerts/:alertId/dismiss'],
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const alertId = String(req.params.alertId);
    const workspaceId = req.workspace!.id;

    try {
      const [biz] = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!biz) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Business not found' },
        });
        return;
      }

      await MarketShiftService.dismissAlert(alertId, businessId);

      res.json({
        success: true,
        message: 'Alert dismissed',
      });
    } catch (err: any) {
      console.error(`Failed to dismiss alert ${alertId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to dismiss alert' },
      });
    }
  }
);

// Public Shared Report Router (No Auth Required)
export const sharedReportsRouter = Router();

sharedReportsRouter.get('/:token', async (req, res): Promise<void> => {
  const token = String(req.params.token);

  try {
    const [share] = await db
      .select()
      .from(reportShares)
      .where(eq(reportShares.shareToken, token))
      .limit(1);

    if (!share) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shared report link not found' },
      });
      return;
    }

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      res.status(410).json({
        success: false,
        error: { code: 'EXPIRED', message: 'This shared report link has expired' },
      });
      return;
    }

    const [reportRec] = await db
      .select({
        report: reports,
        business: businesses,
      })
      .from(reports)
      .innerJoin(businesses, eq(reports.businessId, businesses.id))
      .where(eq(reports.id, share.reportId))
      .limit(1);

    if (!reportRec) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Report not found' },
      });
      return;
    }

    const recs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.reportId, share.reportId))
      .orderBy(recommendations.priority);

    let evidenceList: any[] = [];
    if (share.viewMode === 'specialist') {
      evidenceList = await db
        .select()
        .from(sourceEvidence)
        .where(eq(sourceEvidence.businessId, reportRec.business.id));
    }

    res.json({
      success: true,
      data: {
        share: {
          token: share.shareToken,
          viewMode: share.viewMode,
          expiresAt: share.expiresAt,
        },
        report: reportRec.report,
        business: {
          id: reportRec.business.id,
          name: reportRec.business.name,
          websiteUrl: reportRec.business.websiteUrl,
          city: reportRec.business.city,
        },
        recommendations: recs,
        evidence: evidenceList,
      },
    });
  } catch (err: any) {
    console.error('Error fetching shared report:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load shared report' },
    });
  }
});

export default router;
