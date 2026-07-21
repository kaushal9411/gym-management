import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class MembershipRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async findActiveForMember(tenantId: string, memberId: string) {
    return this.db.membership.findFirst({ where: { tenantId, memberId, status: 'ACTIVE' }, include: { plan: true } });
  }

  async create(data: Prisma.MembershipUncheckedCreateInput) {
    return this.db.membership.create({ data, include: { plan: true } });
  }

  async supersede(id: string): Promise<void> {
    await this.db.membership.update({ where: { id }, data: { status: 'SUPERSEDED' } });
  }

  async cancel(id: string): Promise<void> {
    await this.db.membership.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async update(id: string, data: Omit<Prisma.MembershipUncheckedUpdateInput, 'tenantId' | 'memberId'>) {
    return this.db.membership.update({ where: { id }, data });
  }

  async createFreeze(data: Prisma.MembershipFreezeUncheckedCreateInput) {
    return this.db.membershipFreeze.create({ data });
  }

  async findActiveFreeze(tenantId: string, memberId: string) {
    return this.db.membershipFreeze.findFirst({ where: { tenantId, memberId, unfrozenAt: null } });
  }

  async unfreeze(id: string): Promise<void> {
    await this.db.membershipFreeze.update({ where: { id }, data: { unfrozenAt: new Date() } });
  }
}
