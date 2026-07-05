import type { TenantStatus } from '@prisma/client';

import { env } from '../../../config/env';
import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { securityLogger } from '../../../core/logging/logger';
import { jwtService } from '../../../core/security/jwt.service';
import { generateOpaqueToken, hashToken } from '../../../core/security/token.util';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { passwordResetEmail } from '../../../infrastructure/mail/templates/auth-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { VerificationRepository } from '../../authentication/repositories/verification.repository';
import { adminTenantRepository } from '../repositories/admin-tenant.repository';

const PASSWORD_RESET_TOKEN_BYTES = 32;
const IMPERSONATION_TTL = '10m';

function portalUrl(tenantSlug: string, path: string): string {
  return `http://${tenantSlug}.${env.platformDomain}${path}`;
}

export class AdminTenantService {
  async list(params: { search?: string; status?: TenantStatus; page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const { total, items } = await adminTenantRepository.list({ search: params.search, status: params.status, skip, take: params.limit });
    return {
      items: items.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        trialEndsAt: t.trialEndsAt,
        createdAt: t.createdAt,
        owner: t.users[0] ? { name: t.users[0].name, email: t.users[0].email } : null,
        plan: t.subscriptions[0]?.plan.name ?? null,
        subscriptionStatus: t.subscriptions[0]?.status ?? null,
      })),
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async getById(tenantId: string) {
    const tenant = await adminTenantRepository.findById(tenantId);
    if (!tenant) throw new AppError(ErrorCode.NOT_FOUND, 'Tenant not found', 404);
    return tenant;
  }

  async setStatus(tenantId: string, status: TenantStatus, adminUserId: string, adminRole: string): Promise<void> {
    const before = await this.getById(tenantId);
    const extra = status === 'SUSPENDED' ? { suspendedAt: new Date() } : { suspendedAt: null };
    await adminTenantRepository.updateStatus(tenantId, status, extra);

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: `admin.tenant_status_changed`,
      entityType: 'Tenant',
      entityId: tenantId,
      before: { status: before.status },
      after: { status },
    });
  }

  async softDelete(tenantId: string, adminUserId: string, adminRole: string): Promise<void> {
    await this.getById(tenantId);
    await adminTenantRepository.softDelete(tenantId);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.tenant_deleted', entityType: 'Tenant', entityId: tenantId });
  }

  async resetOwnerPassword(tenantId: string, adminUserId: string, adminRole: string): Promise<{ email: string }> {
    const tenant = await this.getById(tenantId);
    const owner = await adminTenantRepository.findOwner(tenantId);
    if (!owner) throw new AppError(ErrorCode.NOT_FOUND, 'No owner account found for this tenant', 404);

    const db = getTenantScopedClient(tenantId);
    const verificationRepository = new VerificationRepository(db);
    const resetTokenPlain = generateOpaqueToken(PASSWORD_RESET_TOKEN_BYTES);
    await verificationRepository.createPasswordReset(tenantId, owner.id, hashToken(resetTokenPlain), new Date(Date.now() + 30 * 60_000));

    const resetUrl = portalUrl(tenant.slug, `/reset-password?token=${resetTokenPlain}`);
    const template = passwordResetEmail({ tenantName: tenant.name }, owner.name, resetUrl);
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.tenant_owner_password_reset',
      entityType: 'Tenant',
      entityId: tenantId,
    });

    return { email: owner.email };
  }

  /**
   * Issues a genuine, tenant-audience access token for the tenant's owner
   * — access-only (no refresh token), 10-minute TTL, tagged with
   * `impersonatedByAdminId` so the token is self-describing if it ever
   * shows up in a log, and recorded in BOTH audit logs (admin + tenant)
   * since the gym owner should be able to see this happened on their side too.
   */
  async impersonate(tenantId: string, adminUserId: string, adminRole: string): Promise<{ accessToken: string; expiresAt: string; portalUrl: string }> {
    const tenant = await this.getById(tenantId);
    const owner = await adminTenantRepository.findOwner(tenantId);
    if (!owner) throw new AppError(ErrorCode.NOT_FOUND, 'No owner account found for this tenant', 404);

    const db = getTenantScopedClient(tenantId);
    const session = await db.userSession.create({
      data: { tenantId, userId: owner.id, deviceLabel: 'Admin impersonation (read-only, 10 min)' },
    });

    const access = jwtService.signAccessToken({
      userId: owner.id,
      tenantId,
      role: 'OWNER',
      roles: ['OWNER'],
      permVer: 1,
      sessionId: session.id,
      impersonatedByAdminId: adminUserId,
      expiresInOverride: IMPERSONATION_TTL,
    });

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.tenant_impersonated',
      entityType: 'Tenant',
      entityId: tenantId,
    });
    await db.auditLog.create({
      data: { tenantId, actorRole: 'SUPER_ADMIN', action: 'admin_impersonation_started', entityType: 'Tenant', entityId: tenantId },
    });
    securityLogger.warn('Admin impersonation started', { tenantId, adminUserId, ownerUserId: owner.id });

    return { accessToken: access.token, expiresAt: access.expiresAt.toISOString(), portalUrl: portalUrl(tenant.slug, '/dashboard') };
  }

  async subscription(tenantId: string) {
    const tenant = await this.getById(tenantId);
    return tenant.subscriptions[0] ?? null;
  }

  async usage(tenantId: string) {
    const tenant = await this.getById(tenantId);
    return { limits: tenant.limits, usage: tenant.usage };
  }

  async auditLogs(tenantId: string) {
    await this.getById(tenantId);
    return adminTenantRepository.auditLogs(tenantId);
  }
}

export const adminTenantService = new AdminTenantService();
