import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  db,
  businesses,
  businessLocations,
  services,
  keywords,
  searchResults,
  searchRuns,
} from '../db/index.js';
import { WorkspaceRequest } from '../middleware/workspace.js';
import {
  discoverKeywords,
  computeOpportunityScore,
} from '@serp-scout/agents';
import {
  getRankingsForBusiness,
  refreshKeywordRankings,
} from '../services/ranking.service.js';
import { env } from '../config/env.js';

const router = Router();

const updateKeywordSchema = z.object({
  status: z.enum(['candidate', 'approved', 'rejected', 'tracking']).optional(),
  phrase: z.string().min(1).optional(),
  location: z.string().optional(),
  intent: z.string().optional(),
});

const createManualKeywordSchema = z.object({
  phrase: z.string().min(1, 'Keyword phrase is required'),
  location: z.string().optional(),
  intent: z.enum([
    'informational',
    'commercial',
    'transactional',
    'local',
    'navigational',
    'comparison',
    'problem-based',
  ]).optional(),
  status: z.enum(['candidate', 'approved', 'tracking']).default('approved'),
});

// POST /api/businesses/:id/keywords/discover - Run AI keyword discovery
router.post(
  '/:id/keywords/discover',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      // 1. Fetch business & related data
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

      const svcs = await db
        .select()
        .from(services)
        .where(eq(services.businessId, businessId));

      const locs = await db
        .select()
        .from(businessLocations)
        .where(eq(businessLocations.businessId, businessId));

      // 2. Fetch recent search runs to extract SERP titles and PAA
      const recentRuns = await db
        .select()
        .from(searchRuns)
        .where(eq(searchRuns.businessId, businessId))
        .orderBy(desc(searchRuns.requestedAt))
        .limit(10);

      const runIds = recentRuns.map((r) => r.id);
      let serpTitles: string[] = [];

      if (runIds.length > 0) {
        // Scope by run id list: `and(...[])` collapses to no WHERE clause at all,
        // which fed keyword discovery with SERP titles from every other business
        // in the table as soon as the business had more than one stored run.
        const results = await db
          .select({ title: searchResults.title })
          .from(searchResults)
          .where(inArray(searchResults.searchRunId, runIds))
          .limit(50);
        serpTitles = results.map((r) => r.title);
      }

      // 3. Run Keyword Discovery Engine
      const discovered = await discoverKeywords({
        business: {
          name: biz.name,
          category: biz.industry || undefined,
          services: svcs.map((s) => s.name),
          city: biz.city || locs[0]?.city || 'Austin',
        },
        serpTitles,
        maxAiEnrichments: 10,
        apiKey: env.GROQ_API_KEY,
      });

      // 4. Upsert keywords into database
      const savedKeywords = [];
      for (const cand of discovered) {
        const [existing] = await db
          .select()
          .from(keywords)
          .where(and(eq(keywords.businessId, businessId), eq(keywords.phrase, cand.phrase)))
          .limit(1);

        if (existing) {
          const [updated] = await db
            .update(keywords)
            .set({
              intent: cand.intent,
              opportunityScore: cand.opportunityScore,
            })
            .where(eq(keywords.id, existing.id))
            .returning();
          savedKeywords.push(updated);
        } else {
          const [inserted] = await db
            .insert(keywords)
            .values({
              businessId,
              phrase: cand.phrase,
              location: biz.city || locs[0]?.city || null,
              intent: cand.intent,
              opportunityScore: cand.opportunityScore,
              status: 'candidate',
            })
            .returning();
          savedKeywords.push(inserted);
        }
      }

      res.json({
        success: true,
        data: {
          discoveredCount: savedKeywords.length,
          keywords: savedKeywords,
        },
      });
    } catch (err: any) {
      console.error(`Keyword discovery failed for business ${businessId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'DISCOVERY_FAILED', message: err.message || 'Keyword discovery failed' },
      });
    }
  }
);

// GET /api/businesses/:id/keywords - List keywords with latest ranking observations
router.get(
  '/:id/keywords',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;
    const statusFilter = req.query.status as string | undefined;

    try {
      // Verify business belongs to workspace
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

      const rankings = await getRankingsForBusiness(businessId, statusFilter);

      res.json({
        success: true,
        data: rankings,
      });
    } catch (err: any) {
      console.error(`Failed to list keywords for business ${businessId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not fetch keywords' },
      });
    }
  }
);

// POST /api/businesses/:id/keywords - Add keyword manually
router.post(
  '/:id/keywords',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    const parseResult = createManualKeywordSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid keyword payload', details: parseResult.error.format() },
      });
      return;
    }

    const data = parseResult.data;

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

      const cleanPhrase = data.phrase.trim().toLowerCase();

      // Check if keyword already exists
      const [existing] = await db
        .select()
        .from(keywords)
        .where(and(eq(keywords.businessId, businessId), eq(keywords.phrase, cleanPhrase)))
        .limit(1);

      if (existing) {
        res.status(409).json({
          success: false,
          error: { code: 'ALREADY_EXISTS', message: 'Keyword already exists for this business' },
        });
        return;
      }

      // Compute initial opportunity score
      const opportunity = computeOpportunityScore({
        businessRelevance: 80,
        commercialIntent: data.intent === 'transactional' ? 90 : 75,
        localFit: data.location || biz.city ? 85 : 50,
      });

      const [created] = await db
        .insert(keywords)
        .values({
          businessId,
          phrase: cleanPhrase,
          location: data.location || biz.city || null,
          intent: data.intent || 'commercial',
          status: data.status,
          opportunityScore: opportunity.score,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err: any) {
      console.error(`Failed to add keyword for business ${businessId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not create keyword' },
      });
    }
  }
);

// PATCH /api/keywords/:id - Update keyword status or details
router.patch(
  '/keyword/:id',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const keywordId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    const parseResult = updateKeywordSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid update payload' },
      });
      return;
    }

    const data = parseResult.data;

    try {
      // Verify workspace ownership via businesses join
      const [existing] = await db
        .select({ keyword: keywords })
        .from(keywords)
        .innerJoin(businesses, eq(keywords.businessId, businesses.id))
        .where(and(eq(keywords.id, keywordId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Keyword not found' },
        });
        return;
      }

      const [updated] = await db
        .update(keywords)
        .set({
          ...(data.status && { status: data.status }),
          ...(data.phrase && { phrase: data.phrase.trim().toLowerCase() }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.intent && { intent: data.intent }),
        })
        .where(eq(keywords.id, keywordId))
        .returning();

      res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error(`Failed to update keyword ${keywordId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update keyword' },
      });
    }
  }
);

// DELETE /api/keywords/:id - Remove keyword
router.delete(
  '/keyword/:id',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const keywordId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    try {
      const [existing] = await db
        .select({ keyword: keywords })
        .from(keywords)
        .innerJoin(businesses, eq(keywords.businessId, businesses.id))
        .where(and(eq(keywords.id, keywordId), eq(businesses.workspaceId, workspaceId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Keyword not found' },
        });
        return;
      }

      await db.delete(keywords).where(eq(keywords.id, keywordId));

      res.json({
        success: true,
        message: 'Keyword removed successfully',
      });
    } catch (err: any) {
      console.error(`Failed to delete keyword ${keywordId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete keyword' },
      });
    }
  }
);

// POST /api/businesses/:id/rankings/refresh - Refresh rankings for tracked keywords
router.post(
  '/:id/rankings/refresh',
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;
    const searchType = req.body.searchType === 'google_maps' ? 'google_maps' : 'google';

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

      const refreshResult = await refreshKeywordRankings({
        businessId,
        workspaceId,
        searchType,
      });

      res.json({
        success: true,
        data: refreshResult,
      });
    } catch (err: any) {
      console.error(`Failed to refresh rankings for business ${businessId}:`, err);
      res.status(500).json({
        success: false,
        error: { code: 'REFRESH_FAILED', message: err.message || 'Failed to refresh rankings' },
      });
    }
  }
);

export default router;
