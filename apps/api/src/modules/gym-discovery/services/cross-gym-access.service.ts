import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { authLogger } from '../../../core/logging/logger';
import { prisma } from '../../../infrastructure/database/prisma';
import { buildAuthModule } from '../../authentication/utils/auth-module.factory';
import { MemberAuthService } from '../../member-auth/services/member-auth.service';
import { hashPhone } from '../../members/utils/member-pii.util';
import type { Actor } from '../validators/gym-discovery.validators';

/** Same statuses `TenantRepository.listActive` / `discoverGyms` treat as "a login could succeed here". */
const LOGIN_ELIGIBLE_STATUSES = ['ACTIVE', 'TRIAL', 'PAST_DUE'];
/** Upper bound on gyms touched per request — one identity realistically spans a handful. */
const MAX_TENANTS = 10;

const TENANT_SELECT = { id: true, slug: true, status: true, maintenanceMode: true, deletedAt: true } as const;

interface TenantLite {
  id: string;
  slug: string;
  status: string;
  maintenanceMode: boolean;
  deletedAt: Date | null;
}

interface DeviceInfo {
  ipAddress?: string;
  userAgent?: string;
}

const eligible = (t: TenantLite) => t.deletedAt === null && !t.maintenanceMode && LOGIN_ELIGIBLE_STATUSES.includes(t.status);

/**
 * "Forgot password" and "log in with phone number" without ever asking the
 * person which gym they belong to. The mobile app used to put a gym picker in
 * front of both because the tenant-scoped endpoints need a gym; here the server
 * finds every gym the identifier exists in and runs that gym's own, unchanged
 * flow, so each gym's rules (lockouts, 2FA, OTP limits, emails) still apply.
 *
 * Nothing here reveals whether an account exists: the request endpoints always
 * answer the same way, and a wrong code is a generic OTP error.
 */
export class CrossGymAccessService {
  /** Sends the password-reset email for every gym this email (staff) / Member ID (member) exists in. */
  async forgotPassword(identifier: string): Promise<void> {
    const isEmail = identifier.includes('@');
    const tenants = isEmail ? await this.staffTenantsByEmail(identifier.toLowerCase()) : await this.memberTenantsByCode(identifier);
    for (const t of tenants) {
      try {
        if (isEmail) await buildAuthModule(t.id).forgotPassword(identifier.toLowerCase());
        else await new MemberAuthService(t.id).forgotPassword(identifier);
      } catch (error) {
        // One gym failing must not stop the others, nor reveal anything to the caller.
        authLogger.warn('Cross-gym forgot-password failed for one tenant', { tenantId: t.id, error: (error as Error).message });
      }
    }
  }

  /** Emails a one-time code per matching gym account (each gym issues its own, as before). */
  async requestPhoneOtp(phone: string, actorType: Actor): Promise<void> {
    const tenants = actorType === 'staff' ? await this.staffTenantsByPhone(phone) : await this.memberTenantsByPhone(phone);
    for (const t of tenants) {
      try {
        if (actorType === 'staff') await buildAuthModule(t.id).requestPhoneLoginOtp(phone);
        else await new MemberAuthService(t.id).requestPhoneLoginOtp(phone);
      } catch (error) {
        authLogger.warn('Cross-gym phone OTP request failed for one tenant', { tenantId: t.id, error: (error as Error).message });
      }
    }
  }

  /**
   * Tries the code against each matching gym; the gym whose code it is logs the
   * person in. Returns that gym's normal login result plus `tenantSlug`, so the
   * app can load the gym's branding/plan and show only that gym's data.
   */
  async verifyPhoneOtp(phone: string, actorType: Actor, code: string, device: DeviceInfo) {
    const tenants = actorType === 'staff' ? await this.staffTenantsByPhone(phone) : await this.memberTenantsByPhone(phone);
    let expired = false;
    for (const t of tenants) {
      try {
        const result =
          actorType === 'staff'
            ? await buildAuthModule(t.id).verifyPhoneLoginOtp(phone, code, device)
            : await new MemberAuthService(t.id).verifyPhoneLoginOtp(phone, code, device);
        return { ...result, tenantSlug: t.slug };
      } catch (error) {
        if (error instanceof AppError && error.code === ErrorCode.OTP_EXPIRED) expired = true;
        // A locked/suspended account in one gym is that gym's answer; keep trying the others.
      }
    }
    if (expired) throw new AppError(ErrorCode.OTP_EXPIRED, 'This code has expired. Request a new one.', 401);
    throw new AppError(ErrorCode.OTP_INVALID, 'Incorrect code. Check and try again.', 401);
  }

  // ── cross-tenant lookups (RAW prisma on purpose — see GymDiscoveryService) ──

  private async staffTenantsByEmail(email: string): Promise<TenantLite[]> {
    const rows = await prisma.user.findMany({ where: { email, deletedAt: null }, select: { tenant: { select: TENANT_SELECT } }, take: MAX_TENANTS });
    return rows.map((r) => r.tenant).filter(eligible);
  }

  private async staffTenantsByPhone(phone: string): Promise<TenantLite[]> {
    const rows = await prisma.user.findMany({ where: { phone, deletedAt: null }, select: { tenant: { select: TENANT_SELECT } }, take: MAX_TENANTS });
    return rows.map((r) => r.tenant).filter(eligible);
  }

  private async memberTenantsByCode(memberCode: string): Promise<TenantLite[]> {
    const rows = await prisma.member.findMany({ where: { memberId: memberCode, deletedAt: null }, select: { tenant: { select: TENANT_SELECT } }, take: MAX_TENANTS });
    return rows.map((r) => r.tenant).filter(eligible);
  }

  private async memberTenantsByPhone(phone: string): Promise<TenantLite[]> {
    const rows = await prisma.member.findMany({ where: { phoneHash: hashPhone(phone), deletedAt: null }, select: { tenant: { select: TENANT_SELECT } }, take: MAX_TENANTS });
    return rows.map((r) => r.tenant).filter(eligible);
  }
}

export const crossGymAccessService = new CrossGymAccessService();
