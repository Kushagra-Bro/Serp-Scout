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

export function createRedisConnection(): Redis {
  const isTls = env.REDIS_URL.startsWith('rediss://');
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 4, // Force IPv4 to prevent getaddrinfo EAI_AGAIN
    connectTimeout: 15000,
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

  client.on('error', (err: any) => {
    // Gracefully handle temporary DNS hiccups (EAI_AGAIN) or socket resets without crashing the process
    console.warn(`[Redis] Connection / DNS notice (${err.code || err.message}): reconnecting...`);
  });

  return client;
}

export const redisConnection = createRedisConnection();

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 3000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

// 1. Website Analysis Queue (from M2)
export const websiteAnalysisQueue = new Queue('website-analysis', {
  connection: redisConnection,
  defaultJobOptions,
});

// 2. Automated Research Run Queue (M8)
export const researchQueue = new Queue('research-run', {
  connection: redisConnection,
  defaultJobOptions,
});

// 3. Weekly Report Generation Queue (M8)
export const reportQueue = new Queue('weekly-report', {
  connection: redisConnection,
  defaultJobOptions,
});

// 4. Stale-Data Check Queue (M8)
export const staleQueue = new Queue('stale-check', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

// 5. LangGraph Research Pipeline Queue
export const researchGraphQueue = new Queue('research-graph', {
  connection: redisConnection,
  defaultJobOptions,
});

export const allQueues = [
  websiteAnalysisQueue,
  researchQueue,
  reportQueue,
  staleQueue,
  researchGraphQueue,
];

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

/**
 * Fetches recent active, waiting, completed, and failed jobs across all queues,
 * allowing failed jobs to be visible with error messages (Plan.md § acceptance criteria).
 */
export async function getRecentJobs(workspaceId?: string): Promise<UnifiedJobInfo[]> {
  const results: UnifiedJobInfo[] = [];

  for (const queue of allQueues) {
    try {
      const [active, waiting, completed, failed] = await Promise.all([
        queue.getActive(0, 15),
        queue.getWaiting(0, 15),
        queue.getCompleted(0, 20),
        queue.getFailed(0, 20),
      ]);

      const jobs: Job[] = [...active, ...waiting, ...completed, ...failed];

      for (const job of jobs) {
        if (!job) continue;

        // If filtering by workspaceId, check if job.data matches
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
    } catch (err) {
      console.error(`[Queues] Error fetching jobs from queue ${queue.name}:`, err);
    }
  }

  // Sort descending by timestamp
  return results.sort((a, b) => b.timestamp - a.timestamp);
}
