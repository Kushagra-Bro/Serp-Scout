import dns from 'node:dns';
import { Queue, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

// Ensure Node prioritizes IPv4 resolution to prevent EAI_AGAIN on hosts without IPv6 records
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore in environments where setDefaultResultOrder is not supported
}

import { computeRedisBudget } from '../lib/redis-telemetry.js';

// ─────────────────────────────────────────────────────────────────────────────
// Redis Command Telemetry (tracks usage against 500k/month budget)
// ─────────────────────────────────────────────────────────────────────────────
let commandsExecutedCount = 0;
const bootTimestamp = Date.now();

export function getRedisStats() {
  return computeRedisBudget(commandsExecutedCount, Date.now() - bootTimestamp);
}

export function createRedisConnection(): Redis {
  const isTls = env.REDIS_URL.startsWith('rediss://');
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 4, // Force IPv4 to prevent getaddrinfo EAI_AGAIN
    connectTimeout: 15000,
    keepAlive: 30000, // TCP-level keepalive to prevent silent NAT socket drops
    retryStrategy(times) {
      return Math.min(times * 200, 3000);
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET'];
      if (targetErrors.some((target) => err.message.includes(target))) {
        return true;
      }
      return false;
    },
    ...(isTls && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  });

  // Instrument Redis command tracking
  const originalSendCommand = client.sendCommand.bind(client);
  client.sendCommand = function (command: any, ...args: any[]) {
    commandsExecutedCount++;
    return originalSendCommand(command, ...args);
  };

  client.on('error', (err: any) => {
    // Gracefully handle temporary DNS hiccups (EAI_AGAIN) or socket resets without crashing the process
    console.warn(`[Redis] Connection / DNS notice (${err.code || err.message}): reconnecting...`);
  });

  return client;
}

export const redisConnection = createRedisConnection();

export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 3000,
  },
  removeOnComplete: {
    count: 20, // Keep latest 20 completed jobs to prevent Redis hash buildup
    age: 24 * 3600, // 24 hours
  },
  removeOnFail: {
    count: 50, // Keep latest 50 failed jobs
    age: 7 * 24 * 3600, // 7 days
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Two-Worker Queue Architecture (Analysis Queue + Cadence Queue)
// 1. analysisQueue: Dedicated to on-demand scans & LangGraph pipelines (UI-driven)
// 2. cadenceQueue:  Dedicated to background cadence sweeps & weekly reports
// ─────────────────────────────────────────────────────────────────────────────
export const ANALYSIS_QUEUE_NAME = 'serp-scout-analysis';
export const CADENCE_QUEUE_NAME = 'serp-scout-cadence';

export const analysisQueue = new Queue(ANALYSIS_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions,
});

export const cadenceQueue = new Queue(CADENCE_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions,
});

// Backward-compatible alias for any code referencing mainQueue
export const mainQueue = analysisQueue;

/**
 * Backward-compatible queue adapters delegating to appropriate specialized queue.
 */
function createQueueAdapter(targetQueue: Queue, legacyQueueName: string, defaultJobName: string): Queue {
  return {
    name: legacyQueueName,
    add: (name: string, data: any, opts?: any) => {
      return targetQueue.add(name || defaultJobName, data, opts);
    },
    getJob: (jobId: string) => targetQueue.getJob(jobId),
    getJobs: (types: any) => targetQueue.getJobs(types),
    getRepeatableJobs: () => targetQueue.getRepeatableJobs(),
    removeRepeatableByKey: (key: string) => targetQueue.removeRepeatableByKey(key),
    getActive: (...args: any[]) => (targetQueue as any).getActive(...args),
    getWaiting: (...args: any[]) => (targetQueue as any).getWaiting(...args),
    getCompleted: (...args: any[]) => (targetQueue as any).getCompleted(...args),
    getFailed: (...args: any[]) => (targetQueue as any).getFailed(...args),
    close: () => Promise.resolve(),
  } as unknown as Queue;
}

// Backward-compatible exports
export const websiteAnalysisQueue = createQueueAdapter(analysisQueue, 'website-analysis', 'analyze-website');
export const researchGraphQueue = createQueueAdapter(analysisQueue, 'research-graph', 'run-research-graph');
export const researchQueue = createQueueAdapter(cadenceQueue, 'research-run', 'manual-refresh');
export const reportQueue = createQueueAdapter(cadenceQueue, 'weekly-report', 'generate-report');

export const allQueues = [analysisQueue, cadenceQueue];

export interface UnifiedJobInfo {
  id: string;
  queue: string;
  name: string;
  data: any;
  state: string;
  progress: any;
  failedReason?: string;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Cache for Recent Jobs (15s TTL to save Redis calls)
// ─────────────────────────────────────────────────────────────────────────────
const recentJobsCache = new Map<string, { timestamp: number; data: UnifiedJobInfo[] }>();
const RECENT_JOBS_CACHE_TTL_MS = 15000;

/**
 * Fetches recent active, waiting, completed, and failed jobs from both queues.
 * Caches responses in-memory for 15s to conserve Redis commands.
 */
export async function getRecentJobs(workspaceId?: string): Promise<UnifiedJobInfo[]> {
  const cacheKey = workspaceId || '__global__';
  const cached = recentJobsCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < RECENT_JOBS_CACHE_TTL_MS) {
    return cached.data;
  }

  const results: UnifiedJobInfo[] = [];

  try {
    for (const queue of allQueues) {
      const [active, waiting, completed, failed] = await Promise.all([
        queue.getActive(0, 10),
        queue.getWaiting(0, 10),
        queue.getCompleted(0, 15),
        queue.getFailed(0, 15),
      ]);

      const jobs: Job[] = [...active, ...waiting, ...completed, ...failed];

      for (const job of jobs) {
        if (!job) continue;

        if (workspaceId && job.data && job.data.workspaceId && job.data.workspaceId !== workspaceId) {
          continue;
        }

        const state = await job.getState();
        results.push({
          id: String(job.id),
          queue: queue.name,
          name: job.name,
          data: job.data,
          state,
          progress: job.progress,
          failedReason: job.failedReason,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        });
      }
    }
  } catch (err) {
    console.error(`[Queues] Error fetching jobs from queues:`, err);
  }

  // Sort descending by timestamp
  const sorted = results.sort((a, b) => b.timestamp - a.timestamp);
  recentJobsCache.set(cacheKey, { timestamp: now, data: sorted });
  return sorted;
}
