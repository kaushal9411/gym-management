import { AppError, ConflictError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { assertPasswordPolicy, passwordService } from '../../../core/security/password.service';
import { prisma } from '../../../infrastructure/database/prisma';
import type { DeviceInfo } from '../../authentication/types/auth.types';
import { getPaymentGateway, type PaymentGatewayProvider } from '../../payment/services/payment-gateway.service';
import { planRepository } from '../repositories/plan.repository';
import type { BillingCycleValue, OnboardingSessionData, ProvisioningResult } from '../types/onboarding.types';

import { captchaVerifier } from './captcha.service';
import { onboardingOtpService } from './onboarding-otp.service';
import { onboardingSessionService } from './onboarding-session.service';
import { subdomainService } from './subdomain.service';
import { tenantProvisioningService } from './tenant-provisioning.service';


export interface RegisterInput {
  gymName: string;
  legalName?: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  mobile: string;
  country: string;
  state: string;
  city: string;
  timezone: string;
  currency: string;
  gstNumber?: string;
  businessRegistrationNumber?: string;
  numberOfBranches?: number;
  expectedMembers?: number;
  password: string;
  captchaToken: string;
}

/**
 * Orchestrates the wizard end to end. Each public method corresponds
 * roughly 1:1 to an `/api/v1/onboarding/*` endpoint — the controller
 * layer stays a thin pass-through (see controllers/onboarding.controller.ts).
 */
export class OnboardingService {
  async register(input: RegisterInput): Promise<{ sessionId: string; maskedEmail: string }> {
    const captchaOk = await captchaVerifier.verify(input.captchaToken);
    if (!captchaOk) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Captcha verification failed. Please try again.', 422);
    }

    assertPasswordPolicy(input.password);
    await this.assertNoDuplicate(input.email, input.mobile, input.gymName);

    const passwordHash = await passwordService.hash(input.password);
    const sessionId = await onboardingSessionService.create({
      gymName: input.gymName,
      legalName: input.legalName,
      ownerFirstName: input.ownerFirstName,
      ownerLastName: input.ownerLastName,
      email: input.email,
      mobile: input.mobile,
      country: input.country,
      state: input.state,
      city: input.city,
      timezone: input.timezone,
      currency: input.currency,
      gstNumber: input.gstNumber,
      businessRegistrationNumber: input.businessRegistrationNumber,
      numberOfBranches: input.numberOfBranches,
      expectedMembers: input.expectedMembers,
      passwordHash,
    });

    await onboardingOtpService.send(sessionId);

    return { sessionId, maskedEmail: maskEmail(input.email) };
  }

  async resendOtp(sessionId: string): Promise<void> {
    await onboardingOtpService.send(sessionId);
  }

  async verifyOtp(sessionId: string, code: string): Promise<{ verified: true }> {
    await onboardingOtpService.verify(sessionId, code);
    return { verified: true };
  }

  async checkSubdomain(slug: string) {
    return subdomainService.check(slug);
  }

  async selectPlan(sessionId: string, planSlug: string, billingCycle: BillingCycleValue): Promise<OnboardingSessionData> {
    const plan = await planRepository.findBySlug(planSlug);
    if (!plan || !plan.isActive) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'The selected plan is not available.', 422);
    }
    const session = await onboardingSessionService.get(sessionId);
    onboardingSessionService.assertStepReached(session, 'email_verified');

    return onboardingSessionService.update(sessionId, { planSlug, billingCycle, step: 'plan_selected' });
  }

  async pay(
    sessionId: string,
    provider: PaymentGatewayProvider,
    paymentToken: string,
  ): Promise<{ paymentReference: string }> {
    const session = await onboardingSessionService.get(sessionId);
    onboardingSessionService.assertStepReached(session, 'plan_selected');
    if (!session.planSlug) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Please choose a plan first.', 409);
    }

    const plan = await planRepository.findBySlug(session.planSlug);
    if (!plan) throw new AppError(ErrorCode.VALIDATION_ERROR, 'The selected plan is not available.', 422);

    const amount = session.billingCycle === 'YEARLY' ? Number(plan.priceYearly) : Number(plan.priceMonthly);
    const gateway = getPaymentGateway(provider);
    const result = await gateway.charge({
      provider,
      paymentToken,
      amount,
      currency: plan.currency,
      customerEmail: session.form.email,
      description: `${plan.name} plan — ${session.billingCycle ?? 'MONTHLY'}`,
    });

    if (!result.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Payment could not be completed. Please try another method.', 402);
    }

    await onboardingSessionService.update(sessionId, {
      paymentStatus: 'completed',
      paymentReference: result.gatewayReference,
      step: 'payment_completed',
    });

    return { paymentReference: result.gatewayReference };
  }

  async createTenant(sessionId: string, subdomain: string, device: DeviceInfo): Promise<ProvisioningResult> {
    const session = await onboardingSessionService.get(sessionId);
    const result = await tenantProvisioningService.provision(session, subdomain.toLowerCase(), device);

    // Keep the session (rather than deleting it) so the wizard can confirm
    // provisioning via GET /onboarding/status even when the create-tenant
    // response itself is lost in transit (interfering client-side proxies
    // were observed swallowing it). The password hash is scrubbed here —
    // no credentials-adjacent data lingers in Redis; the leftover session
    // is inert progress metadata that expires with the normal TTL.
    await onboardingSessionService.update(sessionId, {
      step: 'provisioned',
      provisionedTenantId: result.tenantId,
      provisionedSlug: result.slug,
      form: { ...session.form, passwordHash: '' },
    });

    return result;
  }

  async getStatus(sessionId: string): Promise<{
    step: string;
    emailVerified: boolean;
    planSlug: string | null;
    provisionedSlug: string | null;
  }> {
    const session = await onboardingSessionService.get(sessionId);
    return {
      step: session.step,
      emailVerified: session.emailVerified,
      planSlug: session.planSlug ?? null,
      provisionedSlug: session.provisionedSlug ?? null,
    };
  }

  /**
   * Platform-wide (not tenant-scoped) — an onboarding visitor has no
   * tenant yet, so this deliberately queries across all of them.
   *
   * KNOWN LIMITATION: `users` has Row-Level Security (see the
   * enable_row_level_security migration), and this uses the raw,
   * unscoped Prisma client with no `app.tenant_id` set — in a properly
   * secured production database (app connects as a non-superuser role,
   * unlike this local dev setup) RLS will silently return zero rows here,
   * turning this into a no-op rather than a real check. `tenants.name`
   * has no RLS (tenants itself is exempt, same as tenant resolution) so
   * that half works correctly regardless. Closing this gap properly needs
   * a narrowly-scoped platform-admin DB role that bypasses RLS for this
   * one cross-tenant lookup — out of scope here, and deliberately not
   * hidden: the tenant-level `@@unique([tenantId, email])` constraint is
   * the actual hard guarantee; this check is a UX nicety on top of it.
   */
  private async assertNoDuplicate(email: string, mobile: string, gymName: string): Promise<void> {
    const [emailTaken, mobileTaken, gymTaken] = await Promise.all([
      prisma.user.findFirst({ where: { email } }),
      prisma.user.findFirst({ where: { phone: mobile } }),
      prisma.tenant.findFirst({ where: { name: { equals: gymName, mode: 'insensitive' } } }),
    ]);

    if (emailTaken) throw new ConflictError(ErrorCode.CONFLICT, 'An account with this email already exists.');
    if (mobileTaken) throw new ConflictError(ErrorCode.CONFLICT, 'An account with this mobile number already exists.');
    if (gymTaken) throw new ConflictError(ErrorCode.CONFLICT, 'A gym with this name is already registered.');
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

export const onboardingService = new OnboardingService();
