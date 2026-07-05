import type { User, UserStatus } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { CreateUserInput, IUserRepository } from '../interfaces/repositories.interface';

export class UserRepository implements IUserRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.db.user.findFirst({ where: { tenantId, email, deletedAt: null } });
  }

  async findById(tenantId: string, userId: string): Promise<User | null> {
    return this.db.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } });
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.db.user.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        status: input.status ?? 'PENDING_VERIFICATION',
      },
    });
  }

  async updatePasswordHash(tenantId: string, userId: string, passwordHash: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId, tenantId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
  }

  async markEmailVerified(tenantId: string, userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId, tenantId },
      data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
    });
  }

  async setStatus(tenantId: string, userId: string, status: UserStatus): Promise<void> {
    await this.db.user.update({ where: { id: userId, tenantId }, data: { status } });
  }

  async recordFailedLogin(tenantId: string, userId: string, lockedUntil: Date | null): Promise<void> {
    await this.db.user.update({
      where: { id: userId, tenantId },
      data: {
        failedLoginAttempts: { increment: 1 },
        ...(lockedUntil ? { lockedUntil, status: 'LOCKED' as const } : {}),
      },
    });
  }

  async resetFailedLogins(tenantId: string, userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId, tenantId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async touchLastLogin(tenantId: string, userId: string): Promise<void> {
    await this.db.user.update({ where: { id: userId, tenantId }, data: { lastLoginAt: new Date() } });
  }
}
