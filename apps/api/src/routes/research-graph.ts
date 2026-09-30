import { Router, Response } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db, businesses, competitors, contentGaps, reports, recommendations } from '../db/index.js';
import { WorkspaceRequest } from '../middleware/workspace.js';
import { researchGraphQueue } from '../jobs/queues.js';
import { executeResearchGraphRun } from '../jobs/workers/research-graph.worker.js';

const router = Router();

const runSchema = z.object({
  /** Run inline and return the result (slower, better for tests/one-off runs). */
  sync: z.boolean().default(false),
  /** Persist a report + recommendations. Defaults to true. */
  persistReport: z.boolean().default(true),
});

/**
 * POST /api/businesses/:id/analysis/run
 *
 * Kicks off the full LangGraph research pipeline for a business. By default the
 * run is queued on BullMQ; pass { "sync": true } to execute inline and get the
 * report straight back.
 */
router.post(
  '/:id/analysis/run',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    const parsed = runSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' },
      });
      return;
    }

    const { sync, persistReport } = parsed.data;

    try {
      const [biz] = await db
        .select({ id: businesses.id })
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

      if (sync) {
        const result = await executeResearchGraphRun({ businessId, workspaceId, persistReport });
        res.json({ success: true, data: result });
        return;
      }

      const job = await researchGraphQueue.add('run-research-graph', {
        businessId,
        workspaceId,
        persistReport,
      });

      res.status(202).json({
        success: true,
        data: {
          jobId: job.id ? String(job.id) : null,
          status: 'queued',
          poll: `/api/jobs`,
        },
      });
    } catch (err: any) {
      console.error(`Research graph run failed for ${businessId}:`, err);
      const quotaHit = /quota/i.test(err?.message || '');
      res.status(quotaHit ? 429 : 500).json({
        success: false,
        error: {
          code: quotaHit ? 'QUOTA_EXCEEDED' : 'RESEARCH_RUN_FAILED',
          message: err.message || 'Failed to run the research pipeline',
        },
      });
    }
  }
);

/**
 * GET /api/businesses/:id/analysis/run/status
 *
 * Returns the most recent persisted research output so the UI can render the
 * latest state without re-running the (paid) pipeline.
 */
router.get(
  '/:id/analysis/run/status',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [biz] = await db
        .select({ id: businesses.id })
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

      const [latestReport] = await db
        .select()
        .from(reports)
        .where(eq(reports.businessId, businessId))
        .orderBy(desc(reports.generatedAt))
        .limit(1);

      const latestRecommendations = latestReport
        ? await db
            .select()
            .from(recommendations)
            .where(eq(recommendations.reportId, latestReport.id))
        : [];

      const competitorList = await db
        .select({
          id: competitors.id,
          name: competitors.name,
          domain: competitors.domain,
          competitorType: competitors.competitorType,
          status: competitors.status,
          confidenceScore: competitors.confidenceScore,
          metadata: competitors.metadata,
        })
        .from(competitors)
        .where(eq(competitors.businessId, businessId));

      const gapList = await db
        .select()
        .from(contentGaps)
        .where(eq(contentGaps.businessId, businessId));

      res.json({
        success: true,
        data: {
          report: latestReport || null,
          recommendations: latestRecommendations,
          competitors: competitorList,
          contentGaps: gapList,
        },
      });
    } catch (err: any) {
      console.error(`Failed to load research status for ${businessId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not load research status' },
      });
    }
  }
);

export default router;
