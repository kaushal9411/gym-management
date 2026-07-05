import { Redis } from 'ioredis';

import { env } from '../../config/env';
import { logger } from '../../core/logging/logger';

/**
 * Single shared ioredis connection for cache + rate limiting + session
 * denylist. BullMQ gets its own connection (required — it manages blocking
 * commands that would otherwise starve this one). See infrastructure/queue.
 */
export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

redis.on('error', (error) => logger.error('Redis connection error', { error: error.message }));
redis.on('connect', () => logger.info('Redis connected'));

const DEFAULT_TTL_SECONDS = 300;

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async set(key: string, value: unknown, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },
  async del(key: string): Promise<void> {
    await redis.del(key);
  },
  async delByPrefix(prefix: string): Promise<void> {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) await redis.del(...keys);
  },
};

export async function disconnectRedis(): Promise<void> {
  redis.disconnect();
}
