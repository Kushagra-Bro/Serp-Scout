type Closable = {
  close(): Promise<unknown>;
};

type GracefulShutdownResources = {
  closeHttpServer: () => Promise<void>;
  workers: readonly Closable[];
  queues: readonly Closable[];
  closeRedis: () => Promise<unknown>;
};

export function createGracefulShutdown(resources: GracefulShutdownResources) {
  let shutdownPromise: Promise<void> | undefined;

  return (signal: string): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      console.info(
        '[Shutdown] Received ' +
          signal +
          '; stopping HTTP traffic and draining workers.'
      );

      const errors: unknown[] = [];

      try {
        await resources.closeHttpServer();
      } catch (error) {
        errors.push(error);
      }

      await closeAll(resources.workers, errors);
      await closeAll(resources.queues, errors);

      try {
        await resources.closeRedis();
      } catch (error) {
        errors.push(error);
      }

      if (errors.length > 0) {
        throw new AggregateError(
          errors,
          'One or more resources failed to close'
        );
      }

      console.info(
        '[Shutdown] HTTP server, workers, queues, and Redis closed.'
      );
    })();

    return shutdownPromise;
  };
}

async function closeAll(resources: readonly Closable[], errors: unknown[]) {
  const results = await Promise.allSettled(
    resources.map(async (resource) => resource.close())
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      errors.push(result.reason);
    }
  }
}
