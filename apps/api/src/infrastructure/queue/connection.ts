import type { ConnectionOptions } from 'bullmq';

import { env } from '../../config/env';

/**
 * BullMQ requires its own Redis connection (it issues blocking commands
 * that would otherwise stall the shared cache connection). We hand it a
 * plain options object rather than a live `ioredis.Redis` instance —
 * BullMQ bundles its own ioredis internally, and passing a
 * separately-instantiated client can trip a structural type mismatch
 * between the two copies. Letting BullMQ construct+own its connection
 * from options avoids that entirely.
 */
export function createQueueConnection(): ConnectionOptions {
  const url = new URL(env.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}
