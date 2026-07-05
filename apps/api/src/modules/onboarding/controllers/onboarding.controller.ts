import type { Request, Response } from 'express';
import type { z } from 'zod';

import { sendSuccess } from '../../../core/http/response';
import { planRepository } from '../repositories/plan.repository';
import { onboardingService } from '../services/onboarding.service';
import type {
  checkSubdomainSchema,
  createTenantSchema,
  onboardingStatusSchema,
  paymentSchema,
  registerOnboardingSchema,
  selectPlanSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from '../validators/onboarding.validators';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;
type TypedQueryRequest<Query> = Request<ParamsDictionary, unknown, unknown, Query>;

function deviceInfo(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export class OnboardingController {
  /** GET /onboarding/plans — not in the prompt's literal endpoint list, but required for the plan-selection step to render anything. */
  async listPlans(_req: Request, res: Response): Promise<void> {
    const plans = await planRepository.listActive();
    sendSuccess(
      res,
      plans.map((plan) => ({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceMonthly: Number(plan.priceMonthly),
        priceYearly: Number(plan.priceYearly),
        currency: plan.currency,
        trialDays: plan.trialDays,
        limits: {
          maxBranches: plan.maxBranches,
          maxManagers: plan.maxManagers,
          maxTrainers: plan.maxTrainers,
          maxReceptionists: plan.maxReceptionists,
          maxStaff: plan.maxStaff,
          maxMembers: plan.maxMembers,
          maxStorageMb: plan.maxStorageMb,
        },
        features: plan.features.map((f) => ({ key: f.key, label: f.label, included: f.included })),
      })),
    );
  }

  async register(req: TypedBodyRequest<z.infer<typeof registerOnboardingSchema>>, res: Response): Promise<void> {
    const result = await onboardingService.register(req.body);
    sendSuccess(res, result, 'Check your email for a verification code.', 201);
  }

  async checkSubdomain(req: TypedQueryRequest<z.infer<typeof checkSubdomainSchema>>, res: Response): Promise<void> {
    const result = await onboardingService.checkSubdomain(req.query.slug);
    sendSuccess(res, result);
  }

  async sendOtp(req: TypedBodyRequest<z.infer<typeof sendOtpSchema>>, res: Response): Promise<void> {
    await onboardingService.resendOtp(req.body.sessionId);
    sendSuccess(res, null, 'A new verification code has been sent.');
  }

  async verifyOtp(req: TypedBodyRequest<z.infer<typeof verifyOtpSchema>>, res: Response): Promise<void> {
    const result = await onboardingService.verifyOtp(req.body.sessionId, req.body.code);
    sendSuccess(res, result, 'Email verified.');
  }

  async selectPlan(req: TypedBodyRequest<z.infer<typeof selectPlanSchema>>, res: Response): Promise<void> {
    const session = await onboardingService.selectPlan(req.body.sessionId, req.body.planSlug, req.body.billingCycle);
    sendSuccess(res, { step: session.step }, 'Plan selected.');
  }

  async pay(req: TypedBodyRequest<z.infer<typeof paymentSchema>>, res: Response): Promise<void> {
    const result = await onboardingService.pay(req.body.sessionId, req.body.provider, req.body.paymentToken);
    sendSuccess(res, result, 'Payment successful.');
  }

  async createTenant(req: TypedBodyRequest<z.infer<typeof createTenantSchema>>, res: Response): Promise<void> {
    const result = await onboardingService.createTenant(req.body.sessionId, req.body.subdomain, deviceInfo(req));
    sendSuccess(res, result, 'Your gym is ready!', 201);
  }

  async status(req: TypedQueryRequest<z.infer<typeof onboardingStatusSchema>>, res: Response): Promise<void> {
    const result = await onboardingService.getStatus(req.query.sessionId);
    sendSuccess(res, result);
  }
}

export const onboardingController = new OnboardingController();
