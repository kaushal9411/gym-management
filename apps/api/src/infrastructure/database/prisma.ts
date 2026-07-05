import { PrismaClient } from '@prisma/client';

import { logger } from '../../core/logging/logger';

/**
 * The RAW client — no tenant scoping. Used only for:
 *   • tenant resolution itself (querying the `tenants` table, which has no
 *     tenant_id column and therefore no RLS policy)
 *   • the seed script (system roles/permissions, which are tenant-agnostic)
 *
 * Every other query MUST go through `getTenantClient()` below. Repositories
 * never import this directly except the tenant repository.
 */
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn' as never, (e: unknown) => logger.warn('Prisma warning', { detail: e }));
prisma.$on('error' as never, (e: unknown) => logger.error('Prisma error', { detail: e }));

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
