import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requireAuthenticatedUser } from './middleware/auth.js';
import { requireWorkspace } from './middleware/workspace.js';
import authRouter from './routes/auth.js';
import workspacesRouter from './routes/workspaces.js';
import businessesRouter from './routes/businesses.js';
import jobsRouter from './routes/jobs.js';
import searchRunsRouter from './routes/search-runs.js';
import competitorsRouter from './routes/competitors.js';
import keywordsRouter from './routes/keywords.js';
import analysisRouter from './routes/analysis.js';
import researchGraphRouter from './routes/research-graph.js';
import reportsRouter, { sharedReportsRouter } from './routes/reports.js';
import schedulesRouter from './routes/schedules.js';
import { startMainJobWorker } from './jobs/workers/main.worker.js';
import { startSystemTimers } from './jobs/system-timers.js';
import { syncAllWorkspaceSchedules } from './jobs/scheduler.js';
import { runCatchUpReconciliation } from './jobs/catchup.js';
import { runRankFreshnessReconciliation } from './jobs/rank-freshness.js';
import { allQueues, redisConnection, getRedisStats } from './jobs/queues.js';
import { createGracefulShutdown } from './graceful-shutdown.js';

const app = express();

app.use(
  cors({
    // `localhost` and `127.0.0.1` are distinct origins to a browser, so a dev
    // server reached over the IP form would have every API call blocked by CORS.
    origin: [
      env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
    credentials: true,
  })
);
app.use(express.json());

// Public health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'serp-scout-api',
    environment: env.NODE_ENV,
    // `connected` is the live socket state: while it is false the queue is
    // retrying, and endpoints that read the queue report empty results quickly
    // rather than hanging (see lib/async-timeout.ts).
    redis: {
      ...getRedisStats(),
      connected: redisConnection.status === 'ready',
      status: redisConnection.status,
    },
    timestamp: new Date().toISOString(),
  });
});

// Native Authentication (Sign-up, Sign-in, User session)
app.use('/api/auth', authRouter);

// Public Shared Reports Route (Token-authenticated for clients/stakeholders)
app.use('/api/shared', sharedReportsRouter);

// Protected Workspace Routes
app.use('/api/workspaces', requireAuthenticatedUser, workspacesRouter);

// Protected Schedules, Notifications, and Automation Routes
app.use('/api/workspaces/me/schedule', requireAuthenticatedUser, requireWorkspace, schedulesRouter);
app.use('/api/schedules', requireAuthenticatedUser, requireWorkspace, schedulesRouter);

// Protected Business Routes (enforcing workspace authorization)
app.use('/api/businesses', requireAuthenticatedUser, requireWorkspace, businessesRouter);
app.use('/api/businesses', requireAuthenticatedUser, requireWorkspace, searchRunsRouter);
app.use('/api/businesses', requireAuthenticatedUser, requireWorkspace, competitorsRouter);
app.use('/api/businesses', requireAuthenticatedUser, requireWorkspace, keywordsRouter);

// Protected Competitor Routes
app.use('/api/competitors', requireAuthenticatedUser, requireWorkspace, competitorsRouter);

// Protected Keyword Routes
app.use('/api/keywords', requireAuthenticatedUser, requireWorkspace, keywordsRouter);

// Protected Analysis Routes
app.use('/api/businesses', requireAuthenticatedUser, requireWorkspace, analysisRouter);
app.use('/api/analysis', requireAuthenticatedUser, requireWorkspace, analysisRouter);

// Protected LangGraph Research Pipeline Routes
app.use('/api/businesses', requireAuthenticatedUser, requireWorkspace, researchGraphRouter);
app.use('/api/research', requireAuthenticatedUser, requireWorkspace, researchGraphRouter);

// Protected Reports & Recommendations Routes
app.use('/api/businesses', requireAuthenticatedUser, requireWorkspace, reportsRouter);
app.use('/api/reports', requireAuthenticatedUser, requireWorkspace, reportsRouter);
app.use('/api/recommendations', requireAuthenticatedUser, requireWorkspace, reportsRouter);

// Protected Search Run & Results inspection
app.use('/api/searches', requireAuthenticatedUser, requireWorkspace, searchRunsRouter);

// Protected Job Polling Routes
app.use('/api/jobs', requireAuthenticatedUser, jobsRouter);

// Start BullMQ Unified Worker and in-process background timers in non-test environments.
// All tasks run on the unified serp-scout-jobs queue to stay well within the
// 500k monthly Upstash request quota.
const workers: Array<{ close(): Promise<unknown> }> = [];
if (env.NODE_ENV !== 'test') {
  workers.push(
    startMainJobWorker(),
    startSystemTimers()
  );
  // Purge repeatables left over from the earlier BullMQ-based scheduler, then
  // reconcile against the database so any occurrence missed while the process
  // was down gets enqueued. A cleanup failure must not block the repair, hence
  // the intermediate catch.
  syncAllWorkspaceSchedules()
    .catch((err) => {
      console.error('Failed to clean up legacy workspace schedules:', err);
    })
    .then(() => runCatchUpReconciliation())
    .then((r) => {
      console.log(
        `[CatchUp] Boot reconciliation: checked ${r.checked}, enqueued ${r.enqueued}, ` +
          `already pending ${r.alreadyPending}, fresh ${r.fresh}, ` +
          `off-cadence ${r.offCadence}, never analyzed ${r.neverAnalyzed}.`
      );
    })
    .catch((err) => {
      console.error('[CatchUp] Boot reconciliation failed:', err);
    })
    // Ranking freshness is reconciled on boot too: positions that went stale
    // while the process was down are re-swept before the user opens the page.
    .then(() => runRankFreshnessReconciliation())
    .then((r) => {
      console.log(
        `[RankFreshness] Boot reconciliation: checked ${r.checked}, enqueued ${r.enqueued}, ` +
          `manual ${r.skippedManual}, awaiting keyword discovery ${r.missingKeywords}.`
      );
    })
    .catch((err) => {
      console.error('[RankFreshness] Boot reconciliation failed:', err);
    });
  console.log('👷 All BullMQ Workers & background timers initialized');
}

// Global JSON Error Handler - Ensures API always returns JSON responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err?.code || 'INTERNAL_SERVER_ERROR',
      message: err?.message || 'An unexpected internal server error occurred',
    },
  });
});

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Serp-Scout API listening on http://localhost:${env.PORT}`);
});

const shutdown = createGracefulShutdown({
  closeHttpServer: () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    }),
  workers,
  queues: allQueues,
  closeRedis: () => redisConnection.quit(),
});

function handleShutdown(signal: 'SIGTERM' | 'SIGINT') {
  void shutdown(signal).catch((error) => {
    console.error('[Shutdown] Graceful shutdown failed after ' + signal + ':', error);
    process.exitCode = 1;
  });
}

process.once('SIGTERM', () => handleShutdown('SIGTERM'));
process.once('SIGINT', () => handleShutdown('SIGINT'));

export default app;
