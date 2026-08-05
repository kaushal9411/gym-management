import { redis } from '../../infrastructure/cache/redis';
import { prisma } from '../../infrastructure/database/prisma';

export type ComponentStatus = 'up' | 'down';

export interface HealthCheckResult {
  /** 'healthy': everything up. 'degraded': DB up, Redis down (the app can still serve most traffic — sessions/rate-limiting/caching just misbehave). 'unhealthy': DB down (nothing works without it). */
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  checks: {
    database: { status: ComponentStatus; latencyMs: number | null };
    redis: { status: ComponentStatus; latencyMs: number | null };
  };
}

async function timed(fn: () => Promise<unknown>): Promise<{ ok: boolean; latencyMs: number | null }> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

/** Real connectivity checks, not a "the process is alive" no-op — a real `SELECT 1` against Postgres and a real `PING` against Redis, each independently timed. */
export async function checkHealth(): Promise<HealthCheckResult> {
  const [db, redisCheck] = await Promise.all([timed(() => prisma.$queryRaw`SELECT 1`), timed(() => redis.ping())]);

  const status: HealthCheckResult['status'] = !db.ok ? 'unhealthy' : !redisCheck.ok ? 'degraded' : 'healthy';

  return {
    status,
    uptimeSeconds: process.uptime(),
    checks: {
      database: { status: db.ok ? 'up' : 'down', latencyMs: db.latencyMs },
      redis: { status: redisCheck.ok ? 'up' : 'down', latencyMs: redisCheck.latencyMs },
    },
  };
}
