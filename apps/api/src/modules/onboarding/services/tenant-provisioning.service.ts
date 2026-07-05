import { randomUUID } from 'node:crypto';

import { env } from '../../../config/env';
import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import { authLogger } from '../../../core/logging/logger';
import { jwtService } from '../../../core/security/jwt.service';
import { generateOpaqueToken, hashToken } from '../../../core/security/token.util';
import { prisma } from '../../../infrastructure/database/prisma';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { RoleRepository } from '../../authentication/repositories/role.repository';
import { SessionRepository } from '../../authentication/repositories/session.repository';
import { UserRepository } from '../../authentication/repositories/user.repository';
import { SystemRole } from '../../authentication/types/auth.types';
import type { DeviceInfo } from '../../authentication/types/auth.types';
import { tenantRepository } from '../../tenants/repository/tenant.repository';
import { tenantService } from '../../tenants/service/tenant.service';
import { planRepository } from '../repositories/plan.repository';
import type { OnboardingSessionData, ProvisioningResult } from '../types/onboarding.types';
import { addBillingPeriod } from '../utils/billing-period';

const REFRESH_TTL_DAYS = env.jwt.refreshTtlDays;
const USAGE_METRICS = ['branches', 'managers', 'trainers', 'members', 'storage_mb'] as const;

/**
 * The Step-7 "Automatic Provisioning" saga — the entire reason this module
 * exists. Runs as a sequence of steps against a pre-generated tenant id
 * (see tenant.repository.ts's createBareTenant for why), not one giant
 * cross-client transaction — matching the precedent already established
 * by the simpler Prompt 5 registration flow, since the tenant-scoped
 * client's per-call `set_config` transaction pattern doesn't compose with
 * an outer multi-table transaction. If any step after tenant creation
 * fails, the tenant row is deleted (cascades clean up every child row
 * created so far) — a compensating action standing in for atomicity.
 */
export class TenantProvisioningService {
  async provision(session: OnboardingSessionData, subdomain: string, device: DeviceInfo = {}): Promise<ProvisioningResult> {
    if (!session.emailVerified) {
      throw new AppError(ErrorCode.EMAIL_NOT_VERIFIED, 'Please verify your email before continuing.', 403);
    }
    if (!session.planSlug || !session.billingCycle) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Please choose a plan before continuing.', 409);
    }

    const plan = await planRepository.findBySlug(session.planSlug);
    if (!plan || !plan.isActive) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'The selected plan is no longer available.', 422);
    }

    const requiresPayment = plan.trialDays <= 0;
    if (requiresPayment && session.paymentStatus !== 'completed') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Payment is required for this plan.', 402);
    }

    await tenantService.assertSlugAvailable(subdomain);

    const tenantId = randomUUID();
    const now = new Date();
    const trialEndsAt = plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 86_400_000) : null;

    try {
      await tenantRepository.createBareTenant({
        id: tenantId,
        slug: subdomain,
        name: session.form.gymName,
        trialEndsAt,
      });

      const db = getTenantScopedClient(tenantId);
      const ownerName = `${session.form.ownerFirstName} ${session.form.ownerLastName}`.trim();

      await db.tenantSettings.create({
        data: {
          tenantId,
          timezone: session.form.timezone,
          currency: session.form.currency,
          branding: {
            primaryColor: 'oklch(0.51 0.23 277)',
            primaryForeground: 'oklch(0.985 0 0)',
            welcomeMessage: `Welcome to ${session.form.gymName}. Sign in to continue.`,
          },
        },
      });

      await db.tenantBranding.create({
        data: {
          tenantId,
          welcomeMessage: `Welcome to ${session.form.gymName}. Sign in to continue.`,
        },
      });

      const domain = `${subdomain}.${env.platformDomain}`;
      await db.tenantDomain.create({
        data: { tenantId, domain, type: 'SUBDOMAIN', isPrimary: true, isVerified: true, dnsVerifiedAt: now },
      });

      await db.branch.create({
        data: { tenantId, name: `${session.form.gymName} — Main Branch`, isDefault: true, timezone: session.form.timezone },
      });

      const userRepository = new UserRepository(db);
      const user = await userRepository.create({
        tenantId,
        name: ownerName,
        email: session.form.email,
        phone: session.form.mobile,
        passwordHash: session.form.passwordHash,
        // Email ownership was already proven by OTP earlier in the wizard —
        // unlike the simpler /auth/register flow, there's no separate
        // post-signup verification link step here.
        status: 'ACTIVE',
      });
      await userRepository.markEmailVerified(tenantId, user.id);

      const roleRepository = new RoleRepository(db);
      await roleRepository.assignSystemRole(tenantId, user.id, SystemRole.OWNER);

      for (const feature of plan.features) {
        await db.tenantModule.create({
          data: { tenantId, key: feature.key, enabled: feature.included },
        });
      }

      await db.tenantLimit.create({
        data: {
          tenantId,
          maxBranches: plan.maxBranches,
          maxManagers: plan.maxManagers,
          maxTrainers: plan.maxTrainers,
          maxReceptionists: plan.maxReceptionists,
          maxStaff: plan.maxStaff,
          maxMembers: plan.maxMembers,
          maxStorageMb: plan.maxStorageMb,
        },
      });

      for (const metric of USAGE_METRICS) {
        await db.tenantUsage.create({
          data: { tenantId, metric, value: metric === 'branches' ? 1 : 0 },
        });
      }

      const currentPeriodEnd = trialEndsAt ?? addBillingPeriod(now, session.billingCycle);
      await db.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: trialEndsAt ? 'TRIALING' : 'ACTIVE',
          billingCycle: session.billingCycle,
          trialEndsAt,
          currentPeriodEnd,
          gatewayCustomerId: session.paymentReference ? `cus_${session.paymentReference}` : null,
          gatewaySubscriptionId: session.paymentReference ?? null,
        },
      });

      await db.auditLog.create({
        data: {
          tenantId,
          actorUserId: user.id,
          actorRole: SystemRole.OWNER,
          action: 'tenant.provisioned',
          entityType: 'tenant',
          entityId: tenantId,
          after: { slug: subdomain, plan: plan.slug, billingCycle: session.billingCycle, trial: Boolean(trialEndsAt) },
        },
      });

      const sessionRepository = new SessionRepository(db);
      const family = randomUUID();
      const refreshPlain = generateOpaqueToken();
      const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000);
      const loginSession = await sessionRepository.create({
        tenantId,
        userId: user.id,
        tokenHash: hashToken(refreshPlain),
        family,
        expiresAt: refreshExpiresAt,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
      });

      const access = jwtService.signAccessToken({
        userId: user.id,
        tenantId,
        role: SystemRole.OWNER,
        roles: [SystemRole.OWNER],
        permVer: 1,
        sessionId: loginSession.sessionId,
      });

      // Note: NOT emitting AuthEvents.UserRegistered here — that event's
      // listener sends a "verify your email" link, but onboarding users are
      // already verified (OTP, earlier in the wizard). The dedicated event
      // below sends a welcome/trial-started email with no verify link.
      eventBus.emitEvent('onboarding.tenant_provisioned', {
        tenantId,
        tenantSlug: subdomain,
        userId: user.id,
        name: ownerName,
        email: session.form.email,
        gymName: session.form.gymName,
        planName: plan.name,
        isTrial: Boolean(trialEndsAt),
        trialEndsAt: trialEndsAt?.toISOString() ?? null,
        portalUrl: `https://${domain}`,
      });

      authLogger.info('Tenant provisioned', { tenantId, slug: subdomain, plan: plan.slug });

      return {
        tenantId,
        slug: subdomain,
        portalUrl: `https://${domain}`,
        userId: user.id,
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshToken: refreshPlain,
      };
    } catch (error) {
      authLogger.error('Provisioning failed — compensating by deleting the partially-created tenant', {
        tenantId,
        error: (error as Error).message,
      });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
      throw error;
    }
  }
}

export const tenantProvisioningService = new TenantProvisioningService();
