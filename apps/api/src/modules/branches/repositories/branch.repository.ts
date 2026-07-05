import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/**
 * Read-only for now — creating/editing additional branches is a future
 * Gym Operations module (Prompt 10 is foundation only). This exists so the
 * portal shell's branch selector has real data instead of a mock list.
 */
export class BranchRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string) {
    return this.db.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }
}
