import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class MemberDocumentRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, memberId: string) {
    return this.db.memberDocument.findMany({ where: { tenantId, memberId }, orderBy: { uploadedAt: 'desc' } });
  }

  async findById(tenantId: string, id: string) {
    return this.db.memberDocument.findFirst({ where: { tenantId, id } });
  }

  async create(data: Prisma.MemberDocumentUncheckedCreateInput) {
    return this.db.memberDocument.create({ data });
  }

  async delete(id: string): Promise<void> {
    await this.db.memberDocument.delete({ where: { id } });
  }
}
