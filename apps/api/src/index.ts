import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { env } from './config/env.js';
import { requireAuthenticatedUser } from './middleware/auth.js';
import { requireWorkspace } from './middleware/workspace.js';
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
import {
  startWebsiteAnalysisWorker,
  startResearchWorker,
} from './jobs/workers/research.worker.js';
import { startReportWorker } from './jobs/workers/report.worker.js';
import { startStaleCheckWorker } from './jobs/workers/stale-check.worker.js';
import { startResearchGraphWorker } from './jobs/workers/research-graph.worker.js';
import { syncAllWorkspaceSchedules } from './jobs/scheduler.js';
import { runCatchUpReconciliation } from './jobs/catchup.js';
import { allQueues, redisConnection } from './jobs/queues.js';
import { createGracefulShutdown } from './graceful-shutdown.js';

const app = express();

app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json());

// Public health check (placed before Clerk middleware so it never triggers dev-browser redirects)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'serp-scout-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Apply Clerk middleware globally to parse authorization tokens
app.use(
  clerkMiddleware({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  })
);

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

// Start BullMQ Workers in non-test environments
const workers: Array<{ close(): Promise<unknown> }> = [];
if (env.NODE_ENV !== 'test') {
  workers.push(
    startWebsiteAnalysisWorker(),
    startResearchWorker(),
    startReportWorker(),
    startStaleCheckWorker(),
    startResearchGraphWorker()
  );
  // Register the repeat jobs first, then reconcile against the database so any
  // occurrence missed while the process was down gets enqueued. Sequencing this
  // matters: the catch-up's pending-job scan must see the freshly registered
  // repeats. A sync failure must not block the repair, hence the intermediate catch.
  syncAllWorkspaceSchedules()
    .catch((err) => {
      console.error('Failed to initialize workspace schedules:', err);
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
    });
  console.log('👷 All BullMQ Workers & Repeatable Schedulers initialized');
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
