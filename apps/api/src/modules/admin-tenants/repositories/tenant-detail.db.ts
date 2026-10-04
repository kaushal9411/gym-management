import { Prisma } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

/**
 * Cross-tenant READ helpers for the admin plane. Tenant-scoped tables have RLS, so raw SQL for ONE chosen tenant sets
 * `app.tenant_id` in the same transaction (same pattern as reports-overview). Never takes tenant ids from request bodies.
 */
export async function rawForTenant<T>(tenantId: string, query: Prisma.Sql): Promise<T[]> {
  const [, rows] = await prisma.$transaction([
    prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    prisma.$queryRaw<T[]>(query),
  ]);
  return rows as T[];
}

/**
 * Admin-only tables (`tenant_admin_notes`, `tenant_admin_tags`) carry an RLS policy that only admits sessions with
 * `app.admin_plane = 'on'`. Tenant/member code paths never set it, so those rows are invisible to them.
 */
export async function withAdminPlane<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.admin_plane', 'on', true)`;
    return fn(tx);
  });
}

export { Prisma };
