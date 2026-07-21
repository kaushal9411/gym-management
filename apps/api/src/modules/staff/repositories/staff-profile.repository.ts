import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class StaffProfileRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async findByUserId(userId: string) {
    return this.db.staffProfile.findUnique({ where: { userId } });
  }

  async findByEmployeeId(tenantId: string, employeeId: string) {
    return this.db.staffProfile.findFirst({ where: { tenantId, employeeId } });
  }

  async create(data: Prisma.StaffProfileUncheckedCreateInput) {
    return this.db.staffProfile.create({ data });
  }

  async update(userId: string, data: Omit<Prisma.StaffProfileUncheckedUpdateInput, 'tenantId' | 'userId'>) {
    await this.db.staffProfile.update({ where: { userId }, data });
  }

  /** Count-based sequence — good enough at gym-staff scale; a collision just retries with the next number. */
  async nextEmployeeId(tenantId: string): Promise<string> {
    const count = await this.db.staffProfile.count({ where: { tenantId } });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `EMP-${String(count + 1 + attempt).padStart(4, '0')}`;
      const existing = await this.findByEmployeeId(tenantId, candidate);
      if (!existing) return candidate;
    }
    return `EMP-${Date.now()}`;
  }
}
