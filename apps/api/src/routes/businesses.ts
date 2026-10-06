import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import {
  db,
  businesses,
  businessLocations,
  services,
} from '../db/index.js';
import { WorkspaceRequest } from '../middleware/workspace.js';
import { isSameWebsiteUrl } from '../lib/website-url.js';
import { websiteAnalysisQueue, researchGraphQueue } from '../jobs/queues.js';

import { env } from '../config/env.js';

const router = Router();

// GET /api/businesses/locations/search - Search locations & places via city, pincode, or business name
router.get('/locations/search', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const query = (req.query.q as string || '').trim();
  if (!query || query.length < 2) {
    res.json({ success: true, data: [] });
    return;
  }

  const isNumericOrPincode = /^\d{3,6}$/.test(query);

  try {
    const results: Array<{
      id: string;
      name: string;
      city?: string;
      address?: string;
      category?: string;
      type: 'location' | 'place';
      countryCode?: string;
    }> = [];

    // 1. Check SerpApi canonical locations (cities / pincodes)
    try {
      const locUrl = new URL('https://serpapi.com/locations.json');
      locUrl.searchParams.set('q', query);
      locUrl.searchParams.set('limit', '6');

      const locRes = await fetch(locUrl.toString());
      if (locRes.ok) {
        const locData = (await locRes.json()) as any;
        if (Array.isArray(locData)) {
          for (const item of locData) {
            results.push({
              id: item.id || String(item.google_id) || item.canonical_name,
              name: item.name,
              city: item.canonical_name ? item.canonical_name.split(',')[0].trim() : item.name,
              address: item.canonical_name,
              category: item.target_type || 'Geographic Area',
              type: 'location',
              countryCode: item.country_code,
            });
          }
        }
      }
    } catch (e) {
      console.warn('SerpApi locations query error:', e);
    }

    // 2. If user is searching a clinic, shop, landmark, or specific place (or if results < 4)
    if (!isNumericOrPincode || results.length === 0) {
      try {
        const mapsUrl = new URL('https://serpapi.com/search.json');
        mapsUrl.searchParams.set('engine', 'google_maps');
        mapsUrl.searchParams.set('q', query);
        mapsUrl.searchParams.set('api_key', env.SERPAPI_KEY);

        const mapsRes = await fetch(mapsUrl.toString());
        if (mapsRes.ok) {
          const mapsData = (await mapsRes.json()) as any;
          if (Array.isArray(mapsData?.local_results)) {
            for (const place of mapsData.local_results.slice(0, 6)) {
              results.push({
                id: place.place_id || place.data_id || place.title,
                name: place.title,
                city: place.address ? place.address.split(',').slice(-3, -2)[0]?.trim() || query : query,
                address: place.address || place.snippet,
                category: place.type || 'Business / Clinic / Shop',
                type: 'place',
              });
            }
          }
        }
      } catch (e) {
        console.warn('SerpApi maps place search error:', e);
      }
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (err: any) {
    console.error('Location search failed:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SEARCH_FAILED', message: err.message || 'Location search failed' },
    });
  }
});

// URL validation schema with safe protocol enforcement
const safeUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, 'URL must use http or https protocol');

const createBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  websiteUrl: safeUrlSchema,
  industry: z.string().optional(),
  description: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  serviceArea: z.string().optional(),
  primaryGoal: z.string().optional(),
  timezone: z.string().optional(),
  locations: z
    .array(
      z.object({
        name: z.string().min(1, 'Location name required'),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        radius: z.number().optional(),
        mapsProfileUrl: z.string().url().optional().or(z.literal('')),
      })
    )
    .optional(),
  services: z
    .array(
      z.object({
        name: z.string().min(1, 'Service name required'),
        description: z.string().optional(),
        priority: z.number().default(1),
      })
    )
    .optional(),
});

const updateBusinessSchema = createBusinessSchema.partial();

/**
 * True when Postgres rejected the write because the unique index on
 * (workspace_id, normalized_url) already holds that website.
 *
 * Matches on the constraint name so an unrelated unique violation (e.g. a
 * future PK clash) still surfaces as a 500 instead of a misleading 409.
 */
function isDuplicateWebsiteError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e.code ?? e.cause?.code;
  const constraint = e.constraint ?? e.cause?.constraint;
  if (code === '23505' && constraint === 'businesses_workspace_normalized_url_uniq') return true;
  // Driver may wrap the original without propagating the constraint name.
  if (code === '23505' && typeof (err as Error).message === 'string') {
    return (err as Error).message.includes('businesses_workspace_normalized_url_uniq');
  }
  return false;
}

// POST /api/businesses - Create a business in active workspace
router.post('/', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspace = req.workspace;
  if (!workspace) {
    res.status(403).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
    return;
  }

  const parseResult = createBusinessSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid business data', details: parseResult.error.format() },
    });
    return;
  }

  const data = parseResult.data;

  try {
    // Duplicate guard: the same website added twice would double the SerpApi
    // quota spend and schedule two identical research runs. Compare on the
    // normalized host so `https://Example.com/` and `www.example.com` match.
    const existingBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, workspace.id));

    const duplicate = existingBusinesses.find((biz) =>
      isSameWebsiteUrl(biz.websiteUrl, data.websiteUrl)
    );

    if (duplicate) {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_WEBSITE',
          message: `"${duplicate.name}" is already being monitored at ${duplicate.websiteUrl} in this workspace.`,
        },
        data: {
          existingBusinessId: duplicate.id,
          existingBusinessName: duplicate.name,
          existingWebsiteUrl: duplicate.websiteUrl,
        },
      });
      return;
    }

    const [newBusiness] = await db
      .insert(businesses)
      .values({
        workspaceId: workspace.id,
        name: data.name,
        websiteUrl: data.websiteUrl,
        industry: data.industry,
        description: data.description,
        country: data.country,
        city: data.city,
        serviceArea: data.serviceArea,
        primaryGoal: data.primaryGoal,
        timezone: data.timezone || workspace.timezone,
      })
      .returning();

    // Insert locations if provided
    let insertedLocations: unknown[] = [];
    if (data.locations && data.locations.length > 0) {
      insertedLocations = await db
        .insert(businessLocations)
        .values(
          data.locations.map((loc) => ({
            businessId: newBusiness.id,
            name: loc.name,
            address: loc.address,
            city: loc.city || data.city,
            country: loc.country || data.country,
            radius: loc.radius,
            mapsProfileUrl: loc.mapsProfileUrl || undefined,
          }))
        )
        .returning();
    }

    // Insert services if provided
    let insertedServices: unknown[] = [];
    if (data.services && data.services.length > 0) {
      insertedServices = await db
        .insert(services)
        .values(
          data.services.map((svc, index) => ({
            businessId: newBusiness.id,
            name: svc.name,
            description: svc.description,
            priority: svc.priority || index + 1,
          }))
        )
        .returning();
    }

    // Kick off the research pipeline right away: it analyses the website,
    // discovers the competitor set and the keyword list to monitor, and then
    // hands off to a ranking sweep. This is what makes a brand-new profile's
    // Keywords/Competitors views pre-computed rather than empty until someone
    // presses a button. A queueing failure must not fail the creation itself —
    // the rank-freshness reconciler picks the business up on its next pass.
    let researchJobId: string | null = null;
    try {
      const job = await researchGraphQueue.add(
        'run-research-graph',
        { businessId: newBusiness.id, workspaceId: workspace.id, persistReport: true },
        { deduplication: { id: `onboard:${newBusiness.id}` } }
      );
      researchJobId = job.id ? String(job.id) : null;
    } catch (err) {
      console.warn('Could not queue the onboarding research run:', err);
    }

    res.status(201).json({
      success: true,
      data: {
        ...newBusiness,
        locations: insertedLocations,
        services: insertedServices,
        researchJobId,
      },
    });
  } catch (err) {
    // A concurrent request can win the race between the SELECT above and this
    // INSERT; the unique index then rejects it. Surface that as a 409 rather
    // than a 500 so the client sees the same answer as the sequential case.
    if (isDuplicateWebsiteError(err)) {
      const existing = await db
        .select()
        .from(businesses)
        .where(eq(businesses.workspaceId, workspace.id))
        .then((rows) =>
          rows.find((biz) => isSameWebsiteUrl(biz.websiteUrl, data.websiteUrl))
        )
        .catch(() => undefined);

      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_WEBSITE',
          message: existing
            ? `"${existing.name}" is already being monitored at ${existing.websiteUrl} in this workspace.`
            : 'This website is already being monitored in this workspace.',
        },
        data: existing
          ? {
              existingBusinessId: existing.id,
              existingBusinessName: existing.name,
              existingWebsiteUrl: existing.websiteUrl,
            }
          : undefined,
      });
      return;
    }

    console.error('Failed to create business:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not create business profile' },
    });
  }
});

// GET /api/businesses - List all businesses in active workspace
router.get('/', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspace = req.workspace;
  if (!workspace) {
    res.status(403).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
    return;
  }

  try {
    const list = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, workspace.id));

    res.json({
      success: true,
      data: list,
    });
  } catch (err) {
    console.error('Failed to list businesses:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not fetch businesses' },
    });
  }
});

// GET /api/businesses/:id - Get detailed business info with locations and services
router.get('/:id', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspace = req.workspace;
  const businessId = String(req.params.id);

  try {
    const [biz] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspace!.id)))
      .limit(1);

    if (!biz) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Business not found in this workspace' },
      });
      return;
    }

    const locs = await db
      .select()
      .from(businessLocations)
      .where(eq(businessLocations.businessId, businessId));

    const svcs = await db
      .select()
      .from(services)
      .where(eq(services.businessId, businessId));

    res.json({
      success: true,
      data: {
        ...biz,
        locations: locs,
        services: svcs,
      },
    });
  } catch (err) {
    console.error('Failed to fetch business details:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not fetch business' },
    });
  }
});

// PATCH /api/businesses/:id - Update business
router.patch('/:id', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspace = req.workspace;
  const businessId = String(req.params.id);

  const parseResult = updateBusinessSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid update data', details: parseResult.error.format() },
    });
    return;
  }

  const data = parseResult.data;

  try {
    // Existence first: a PATCH to a business that isn't here must 404, even if
    // the requested URL happens to collide with a sibling.
    const target = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspace!.id)))
      .limit(1);

    if (target.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Business not found' },
      });
      return;
    }

    // Reject retargeting a business onto a website another business already owns.
    if (data.websiteUrl) {
      const allInWorkspace = await db
        .select()
        .from(businesses)
        .where(eq(businesses.workspaceId, workspace!.id));

      const conflict = allInWorkspace.find(
        (biz) => biz.id !== businessId && isSameWebsiteUrl(biz.websiteUrl, data.websiteUrl!)
      );

      if (conflict) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_WEBSITE',
            message: `"${conflict.name}" is already monitoring ${conflict.websiteUrl} in this workspace.`,
          },
          data: {
            existingBusinessId: conflict.id,
            existingBusinessName: conflict.name,
          },
        });
        return;
      }
    }

    const [updated] = await db
      .update(businesses)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.websiteUrl && { websiteUrl: data.websiteUrl }),
        ...(data.industry !== undefined && { industry: data.industry }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.serviceArea !== undefined && { serviceArea: data.serviceArea }),
        ...(data.primaryGoal !== undefined && { primaryGoal: data.primaryGoal }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        updatedAt: new Date(),
      })
      .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspace!.id)))
      .returning();

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Business not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    // Same race as POST: another request claimed the URL between our SELECT
    // and this UPDATE. Return 409 rather than 500.
    if (isDuplicateWebsiteError(err)) {
      const conflict = await db
        .select()
        .from(businesses)
        .where(eq(businesses.workspaceId, workspace!.id))
        .then((rows) =>
          rows.find(
            (biz) => biz.id !== businessId && isSameWebsiteUrl(biz.websiteUrl, data.websiteUrl!)
          )
        )
        .catch(() => undefined);

      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_WEBSITE',
          message: conflict
            ? `"${conflict.name}" is already monitoring ${conflict.websiteUrl} in this workspace.`
            : 'This website is already being monitored in this workspace.',
        },
        data: conflict
          ? { existingBusinessId: conflict.id, existingBusinessName: conflict.name }
          : undefined,
      });
      return;
    }

    console.error('Failed to update business:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not update business' },
    });
  }
});

// DELETE /api/businesses/:id - Delete business
router.delete('/:id', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspace = req.workspace;
  const businessId = String(req.params.id);

  try {
    const deleted = await db
      .delete(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspace!.id)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Business not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Business deleted successfully',
    });
  } catch (err) {
    console.error('Failed to delete business:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not delete business' },
    });
  }
});

// POST /api/businesses/:id/analyze - Trigger async website analysis
router.post('/:id/analyze', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspace = req.workspace;
  const businessId = String(req.params.id);

  try {
    const [biz] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspace!.id)))
      .limit(1);

    if (!biz) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Business not found in this workspace' },
      });
      return;
    }

    // Add job to BullMQ queue
    const job = await websiteAnalysisQueue.add('analyze-website', {
      businessId: biz.id,
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        businessId: biz.id,
        status: 'queued',
        websiteUrl: biz.websiteUrl,
      },
    });
  } catch (err) {
    console.error('Failed to enqueue website analysis job:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to schedule website analysis' },
    });
  }
});

export default router;
