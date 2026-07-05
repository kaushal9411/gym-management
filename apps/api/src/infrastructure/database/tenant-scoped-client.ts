import { Prisma } from '@prisma/client';

import { prisma } from './prisma';

/**
 * Layer 2 + 3 of tenant isolation (see docs/architecture/ARCHITECTURE.md §6):
 *   • Layer 2: every query issued through the returned client is executed
 *     alongside a `set_config('app.tenant_id', tenantId, true)` in the SAME
 *     transaction (Prisma's documented pattern for Postgres RLS), so the
 *     database session variable is always set correctly per call.
 *   • Layer 3: PostgreSQL Row-Level Security policies (see the
 *     enable_row_level_security migration) read that session variable and
 *     physically cannot return rows from another tenant — even a bug in
 *     application code (a forgotten `where: { tenantId }`) is contained.
 *
 * Repositories receive ONLY this client via DI — never the raw `prisma`
 * export — so it is structurally impossible for authentication-module
 * code to query across tenants.
 */
export type TenantScopedPrisma = ReturnType<typeof getTenantScopedClient>;

export function getTenantScopedClient(tenantId: string) {
  return prisma.$extends({
    name: 'tenant-scoped-rls',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export { Prisma };
