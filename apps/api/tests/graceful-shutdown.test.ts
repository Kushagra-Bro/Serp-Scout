import assert from 'node:assert/strict';
import test from 'node:test';
import { createGracefulShutdown } from '../src/graceful-shutdown.js';

function closable(name: string, calls: string[]) {
  return {
    async close() {
      calls.push(name);
    },
  };
}

test('closes HTTP traffic, workers, queues, and Redis in order', async () => {
  const calls: string[] = [];
  const shutdown = createGracefulShutdown({
    closeHttpServer: async () => {
      calls.push('server');
    },
    workers: [closable('worker-1', calls), closable('worker-2', calls)],
    queues: [closable('queue-1', calls), closable('queue-2', calls)],
    closeRedis: async () => {
      calls.push('redis');
    },
  });

  await shutdown('SIGTERM');

  assert.deepEqual(calls, [
    'server',
    'worker-1',
    'worker-2',
    'queue-1',
    'queue-2',
    'redis',
  ]);
});

test('waits for active workers and shares one shutdown across signals', async () => {
  const calls: string[] = [];
  let releaseWorker!: () => void;
  let markWorkerStarted!: () => void;
  const workerStarted = new Promise<void>((resolve) => {
    markWorkerStarted = resolve;
  });
  const workerDrain = new Promise<void>((resolve) => {
    releaseWorker = resolve;
  });
  const shutdown = createGracefulShutdown({
    closeHttpServer: async () => {
      calls.push('server');
    },
    workers: [
      {
        async close() {
          calls.push('worker-start');
          markWorkerStarted();
          await workerDrain;
          calls.push('worker-finished');
        },
      },
    ],
    queues: [closable('queue', calls)],
    closeRedis: async () => {
      calls.push('redis');
    },
  });

  const firstShutdown = shutdown('SIGTERM');
  assert.equal(shutdown('SIGINT'), firstShutdown);
  await workerStarted;

  assert.deepEqual(calls, ['server', 'worker-start']);

  releaseWorker();
  await firstShutdown;

  assert.deepEqual(calls, [
    'server',
    'worker-start',
    'worker-finished',
    'queue',
    'redis',
  ]);
});

test('continues closing resources and reports failures', async () => {
  const calls: string[] = [];
  const workerError = new Error('worker close failed');
  const shutdown = createGracefulShutdown({
    closeHttpServer: async () => {
      calls.push('server');
    },
    workers: [
      {
        async close() {
          calls.push('worker-failed');
          throw workerError;
        },
      },
      closable('worker-2', calls),
    ],
    queues: [closable('queue', calls)],
    closeRedis: async () => {
      calls.push('redis');
    },
  });

  await assert.rejects(shutdown('SIGTERM'), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [workerError]);
    return true;
  });
  assert.deepEqual(calls, [
    'server',
    'worker-failed',
    'worker-2',
    'queue',
    'redis',
  ]);
});
