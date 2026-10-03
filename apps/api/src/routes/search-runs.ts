import { Router, Response } from 'express';
import { z } from 'zod';
import { WorkspaceRequest } from '../middleware/workspace.js';
import { enforceQuota } from '../middleware/quota.js';
import {
  executeSearchRun,
  listSearchRunsForBusiness,
  getSearchRunDetails,
} from '../services/search-run.service.js';
import { classifySearchError, providerNameFromError } from '../lib/search-errors.js';

const router = Router();

const searchRequestSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  searchType: z.enum(['google', 'google_maps', 'google_news']).default('google'),
  location: z.string().optional(),
  language: z.string().default('en'),
  country: z.string().default('us'),
  device: z.enum(['desktop', 'mobile']).default('desktop'),
  num: z.number().min(1).max(100).default(20),
});

// POST /api/businesses/:id/searches - Execute a search run
router.post(
  '/:id/searches',
  enforceQuota,
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const businessId = String(req.params.id);
    const workspaceId = req.workspace!.id;

    const parseResult = searchRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search parameters',
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const data = parseResult.data;

    try {
      const output = await executeSearchRun({
        businessId,
        workspaceId,
        searchType: data.searchType,
        query: data.query,
        location: data.location,
        language: data.language,
        country: data.country,
        device: data.device,
        num: data.num,
      });

      res.status(201).json({
        success: true,
        data: output,
      });
    } catch (err: any) {
      console.error(`Search run failed for business ${businessId}:`, err);
      const kind = classifySearchError(err);
      const quota = kind === 'workspace-quota';
      const providerOut = kind === 'provider-quota';
      const status = quota || providerOut ? 429 : 500;
      const provider = providerNameFromError(err);

      if (quota) res.set('Retry-After', '86400');
      res.status(status).json({
        success: false,
        error: {
          code: quota
            ? 'QUOTA_EXCEEDED'
            : providerOut
            ? 'PROVIDER_QUOTA_EXCEEDED'
            : 'SEARCH_FAILED',
          message: providerOut
            ? `${provider} is out of quota for this account. Retry after the provider resets its monthly cycle.`
            : err.message || 'Search execution failed',
        },
      });
    }
  }
);

// GET /api/businesses/:id/searches - List search runs for a business
router.get('/:id/searches', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const businessId = String(req.params.id);
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  try {
    const runs = await listSearchRunsForBusiness(businessId, limit);
    res.json({
      success: true,
      data: runs,
    });
  } catch (err: any) {
    console.error(`Failed to list search runs for business ${businessId}:`, err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not fetch search history' },
    });
  }
});

// GET /api/searches/:id - Get a single search run with its results
router.get('/run/:id', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const runId = String(req.params.id);

  try {
    const details = await getSearchRunDetails(runId);
    if (!details) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Search run not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: details,
    });
  } catch (err: any) {
    console.error(`Failed to fetch search run ${runId}:`, err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not fetch search run details' },
    });
  }
});

export default router;
