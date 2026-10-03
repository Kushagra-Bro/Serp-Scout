import { Worker, Job, UnrecoverableError } from 'bullmq';
import { redisConnection, ANALYSIS_QUEUE_NAME, CADENCE_QUEUE_NAME } from '../queues.js';
import {
  executeWebsiteAnalysis,
  WebsiteAnalysisJobData,
  executeResearchRun,
  ResearchRunJobData,
} from './research.worker.js';
import { executeReportGeneration, ReportJobData } from './report.worker.js';
import { executeResearchGraphRun, ResearchGraphJobData } from './research-graph.worker.js';
import { classifySearchError } from '../../lib/search-errors.js';

/**
 * Worker 1: Analysis & Pipeline Worker
 * Processes user-initiated, on-demand operations: website crawl/extraction
 * and the 11-node LangGraph deep research pipeline.
 */
export function startAnalysisWorker() {
  const worker = new Worker(
    ANALYSIS_QUEUE_NAME,
    async (job: Job) => {
      console.log(`[AnalysisWorker] Processing job "${job.name}" (ID: ${job.id})`);

      try {
        switch (job.name) {
          case 'analyze-website':
          case 'website-analysis':
            return await executeWebsiteAnalysis(job.data as WebsiteAnalysisJobData);

          case 'run-research-graph':
          case 'research-graph':
            return await executeResearchGraphRun(job.data as ResearchGraphJobData);

          default:
            console.warn(`[AnalysisWorker] Unknown job name: ${job.name}. Skipping.`);
            return { skipped: true, unknownName: job.name };
        }
      } catch (err: any) {
        if (classifySearchError(err) !== 'other') {
          throw new UnrecoverableError(err?.message || String(err));
        }
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // Deep research graph is fan-out and LLM heavy
      lockDuration: 300000, // 5 minutes
      stalledInterval: 30 * 60 * 1000, // 30 minutes: minimizes Redis EVAL Lua commands
      maxStalledCount: 1,
      drainDelay: 60, // 60s idle pop block: ~1 command per minute on Upstash
    }
  );

  worker.on('completed', (job) => {
    console.log(`[AnalysisWorker] Job "${job.name}" (${job.id}) completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[AnalysisWorker] Job "${job?.name}" (${job?.id}) failed:`, err?.message || err);
  });

  return worker;
}

/**
 * Worker 2: Scheduled Cadence & Reporting Worker
 * Processes background tasks: periodic ranking sweeps, 6-hour catch-up reconciliations,
 * weekly executive report synthesis, PDF compilation, and Resend transactional alerts.
 */
export function startCadenceWorker() {
  const worker = new Worker(
    CADENCE_QUEUE_NAME,
    async (job: Job) => {
      console.log(`[CadenceWorker] Processing job "${job.name}" (ID: ${job.id})`);

      try {
        switch (job.name) {
          case 'manual-refresh':
          case 'cadence-refresh':
          case 'catch-up-refresh':
          case 'research-run':
            return await executeResearchRun(job.data as ResearchRunJobData);

          case 'generate-report':
          case 'weekly-report':
            return await executeReportGeneration(job.data as ReportJobData);

          default:
            console.warn(`[CadenceWorker] Unknown job name: ${job.name}. Skipping.`);
            return { skipped: true, unknownName: job.name };
        }
      } catch (err: any) {
        if (classifySearchError(err) !== 'other') {
          throw new UnrecoverableError(err?.message || String(err));
        }
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2, // Background cadence refreshes and report emails can run in parallel
      lockDuration: 300000, // 5 minutes
      stalledInterval: 30 * 60 * 1000, // 30 minutes
      maxStalledCount: 1,
      drainDelay: 60, // 60s idle pop block: ~1 command per minute on Upstash
    }
  );

  worker.on('completed', (job) => {
    console.log(`[CadenceWorker] Job "${job.name}" (${job.id}) completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[CadenceWorker] Job "${job?.name}" (${job?.id}) failed:`, err?.message || err);
  });

  return worker;
}

/**
 * Starts both specialized workers (AnalysisWorker and CadenceWorker).
 * Returns an aggregate handle for graceful shutdown.
 */
export function startMainJobWorker() {
  const analysisWorker = startAnalysisWorker();
  const cadenceWorker = startCadenceWorker();

  return {
    async close() {
      await Promise.allSettled([
        analysisWorker.close(),
        cadenceWorker.close(),
      ]);
    },
  };
}
