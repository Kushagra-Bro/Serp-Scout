import { Router, Response } from 'express';
import { z } from 'zod';
import { db, workspaces, businesses, notifications } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';
import { WorkspaceRequest } from '../middleware/workspace.js';
import {
  scheduleWorkspaceResearch,
  triggerImmediateRefresh,
  removeWorkspaceRepeatableJobs,
} from '../jobs/scheduler.js';
import { computeNextCadenceRun, CADENCE_CRON_PATTERNS } from '../lib/cadence.js';
import { getRecentJobs } from '../jobs/queues.js';

const router = Router();

const updateScheduleSchema = z.object({
  refreshCadence: z.enum(['daily', 'weekly', 'monthly', 'manual']),
  notificationEmail: z.string().email().optional().or(z.literal('')),
  staleDaysThreshold: z.number().int().min(1).max(90).default(7),
});

// GET /api/workspaces/me/schedule - Retrieve current schedule settings
router.get('/', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspaceId = req.workspace?.id;
  if (!workspaceId) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_WORKSPACE', message: 'No active workspace found' },
    });
    return;
  }

  try {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
      return;
    }

    const allBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, workspaceId));

    // Next scheduled run derived from the cadence in Postgres (the source of
    // truth) rather than a BullMQ repeatable, so no Redis scan is needed.
    const nextRunAt = computeNextCadenceRun(workspace.refreshCadence);
    const cronPattern =
      workspace.refreshCadence && workspace.refreshCadence !== 'manual'
        ? CADENCE_CRON_PATTERNS[workspace.refreshCadence] ?? null
        : null;

    res.json({
      success: true,
      data: {
        workspaceId,
        refreshCadence: workspace.refreshCadence || 'weekly',
        notificationEmail: workspace.notificationEmail || null,
        staleDaysThreshold: workspace.staleDaysThreshold || 7,
        lastScheduledRunAt: workspace.lastScheduledRunAt,
        nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
        cronPattern,
        businesses: allBusinesses.map((biz) => ({
          id: biz.id,
          name: biz.name,
          dataStale: biz.dataStale,
          lastAnalyzedAt: biz.lastAnalyzedAt,
        })),
      },
    });
  } catch (err: any) {
    console.error('Failed to get schedule settings:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve schedule' },
    });
  }
});

// PUT /api/workspaces/me/schedule - Update schedule & notification settings
router.put('/', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspaceId = req.workspace?.id;
  if (!workspaceId) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_WORKSPACE', message: 'No active workspace found' },
    });
    return;
  }

  const parseResult = updateScheduleSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid schedule parameters',
        details: parseResult.error.format(),
      },
    });
    return;
  }

  const { refreshCadence, notificationEmail, staleDaysThreshold } = parseResult.data;

  try {
    // 1. Update database
    const [updatedWorkspace] = await db
      .update(workspaces)
      .set({
        refreshCadence,
        notificationEmail: notificationEmail || null,
        staleDaysThreshold,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    // 2. Fail-safe cleanup of any legacy repeatables for this workspace;
    //    cadence itself is enforced by the periodic reconciler reading Postgres.
    await removeWorkspaceRepeatableJobs(workspaceId);

    const allBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, workspaceId));

    const scheduleResults: Array<{ businessId: string; scheduled: boolean; pattern?: string }> = [];
    for (const biz of allBusinesses) {
      const result = await scheduleWorkspaceResearch({
        workspaceId,
        cadence: refreshCadence,
        businessId: biz.id,
      });
      scheduleResults.push({ businessId: biz.id, ...result });
    }

    const scheduleStatus = {
      scheduled: scheduleResults.some((r) => r.scheduled),
      businesses: scheduleResults,
    };

    res.json({
      success: true,
      data: {
        refreshCadence: updatedWorkspace.refreshCadence,
        notificationEmail: updatedWorkspace.notificationEmail,
        staleDaysThreshold: updatedWorkspace.staleDaysThreshold,
        scheduleStatus,
      },
    });
  } catch (err: any) {
    console.error('Failed to update schedule:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save schedule settings' },
    });
  }
});

// POST /api/workspaces/me/schedule/trigger - Trigger immediate refresh run
router.post('/trigger', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspaceId = req.workspace?.id;
  if (!workspaceId) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_WORKSPACE', message: 'No active workspace found' },
    });
    return;
  }

  try {
    const allBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, workspaceId));

    if (allBusinesses.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No business found in workspace to refresh' },
      });
      return;
    }

    const results = [];
    for (const biz of allBusinesses) {
      const result = await triggerImmediateRefresh({
        workspaceId,
        businessId: biz.id,
      });
      results.push({ businessId: biz.id, businessName: biz.name, ...result });
    }

    res.json({
      success: true,
      data: {
        message: `Immediate refresh enqueued for ${results.length} business(es)`,
        results,
      },
    });
  } catch (err: any) {
    console.error('Failed to trigger refresh:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to trigger refresh' },
    });
  }
});

// GET /api/workspaces/me/jobs - List recent and failed jobs with error reasons
router.get('/jobs', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspaceId = req.workspace?.id;
  if (!workspaceId) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_WORKSPACE', message: 'No active workspace found' },
    });
    return;
  }

  try {
    const jobs = await getRecentJobs(workspaceId);
    res.json({
      success: true,
      data: jobs,
    });
  } catch (err: any) {
    console.error('Failed to fetch job history:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve jobs' },
    });
  }
});

// GET /api/workspaces/me/notifications - List sent notification history
router.get('/notifications', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const workspaceId = req.workspace?.id;
  if (!workspaceId) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_WORKSPACE', message: 'No active workspace found' },
    });
    return;
  }

  try {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.workspaceId, workspaceId))
      .orderBy(desc(notifications.sentAt))
      .limit(50);

    res.json({
      success: true,
      data: list,
    });
  } catch (err: any) {
    console.error('Failed to fetch notifications:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch notifications' },
    });
  }
});

export default router;
