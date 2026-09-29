import type { DeviceTokenPlatform } from '@prisma/client';

import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { enqueuePush } from '../../../infrastructure/queue/push.queue';
import { MemberDeviceTokenRepository } from '../repositories/member-device-token.repository';
import { StaffDeviceTokenRepository } from '../repositories/staff-device-token.repository';

export class DeviceTokenService {
  async registerStaffToken(tenantId: string, userId: string, token: string, platform: DeviceTokenPlatform): Promise<void> {
    const repository = new StaffDeviceTokenRepository(getTenantScopedClient(tenantId));
    await repository.upsert(tenantId, userId, token, platform);
  }

  async unregisterStaffToken(tenantId: string, token: string): Promise<void> {
    const repository = new StaffDeviceTokenRepository(getTenantScopedClient(tenantId));
    await repository.remove(tenantId, token);
  }

  async registerMemberToken(tenantId: string, memberId: string, token: string, platform: DeviceTokenPlatform): Promise<void> {
    const repository = new MemberDeviceTokenRepository(getTenantScopedClient(tenantId));
    await repository.upsert(tenantId, memberId, token, platform);
  }

  async unregisterMemberToken(tenantId: string, token: string): Promise<void> {
    const repository = new MemberDeviceTokenRepository(getTenantScopedClient(tenantId));
    await repository.remove(tenantId, token);
  }

  /** Every staff device in the tenant — mirrors the existing tenant-level (not per-user) `TenantNotification` feed's own simplification. */
  async pushToStaff(tenantId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    const repository = new StaffDeviceTokenRepository(getTenantScopedClient(tenantId));
    const tokens = await repository.listTokensForTenant(tenantId);
    await enqueuePush({ tenantId, tokens, tokenOwner: 'STAFF', title, body, data });
  }

  async pushToMember(tenantId: string, memberId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    const repository = new MemberDeviceTokenRepository(getTenantScopedClient(tenantId));
    const tokens = await repository.listTokensForMember(tenantId, memberId);
    await enqueuePush({ tenantId, tokens, tokenOwner: 'MEMBER', title, body, data });
  }

  /** Announcement bulk fan-out — `branchId` narrows to that branch's members when the announcement targets one. */
  async pushToMembersInTenant(tenantId: string, title: string, body: string, branchId?: string, data?: Record<string, string>): Promise<void> {
    const repository = new MemberDeviceTokenRepository(getTenantScopedClient(tenantId));
    const tokens = await repository.listTokensForTenant(tenantId, branchId);
    await enqueuePush({ tenantId, tokens, tokenOwner: 'MEMBER', title, body, data });
  }
}

export const deviceTokenService = new DeviceTokenService();
