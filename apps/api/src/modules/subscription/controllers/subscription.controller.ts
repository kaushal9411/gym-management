import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { UserRepository } from '../../authentication/repositories/user.repository';
import { planRepository } from '../../onboarding/repositories/plan.repository';
import { SubscriptionService } from '../services/subscription.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

interface CheckoutBody {
  planSlug: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  couponCode?: string;
  provider?: 'stripe' | 'razorpay' | 'paypal';
  paymentToken?: string;
}

async function currentUserEmail(req: Request, db: ReturnType<typeof getTenantScopedClient>): Promise<string> {
  const userRepository = new UserRepository(db);
  const user = await userRepository.findById(req.tenant!.id, req.auth!.sub);
  if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found.', 404);
  return user.email;
}

function idempotencyKey(req: Request): string {
  const header = req.headers['idempotency-key'];
  return typeof header === 'string' && header.length > 0 ? header : randomUUID();
}

export class SubscriptionController {
  /** GET /subscription — the current plan/status for the logged-in tenant. */
  async getCurrent(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const service = new SubscriptionService(getTenantScopedClient(tenantId));
    const subscription = await service.getCurrent(tenantId);
    sendSuccess(res, subscription);
  }

  /** POST /subscription — Create Subscription (a tenant with no paid plan yet chooses one). */
  async create(req: TypedBodyRequest<CheckoutBody>, res: Response): Promise<void> {
    await this.runCheckout(req, res);
  }

  /** POST /subscription/upgrade — Upgrade Subscription. */
  async upgrade(req: TypedBodyRequest<CheckoutBody>, res: Response): Promise<void> {
    await this.assertDirection(req, 'upgrade');
    await this.runCheckout(req, res);
  }

  /** POST /subscription/downgrade — Downgrade Subscription. */
  async downgrade(req: TypedBodyRequest<CheckoutBody>, res: Response): Promise<void> {
    await this.assertDirection(req, 'downgrade');
    await this.runCheckout(req, res);
  }

  /** POST /subscription/cancel — Cancel Subscription (immediately or at period end). */
  async cancel(req: TypedBodyRequest<{ immediate: boolean; reason?: string }>, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const service = new SubscriptionService(getTenantScopedClient(tenantId));
    const subscription = await service.cancel(tenantId, req.body.immediate, req.body.reason);
    sendSuccess(res, subscription, 'Subscription cancelled.');
  }

  /** POST /subscription/renew — Renew Subscription using the saved default payment method. */
  async renew(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const db = getTenantScopedClient(tenantId);
    const email = await currentUserEmail(req, db);
    const service = new SubscriptionService(db);
    const result = await service.renew(tenantId, req.tenant!.name, email, idempotencyKey(req));
    sendSuccess(res, result, 'Subscription renewed.');
  }

  /** GET /subscription/history — subscription state transition audit trail. */
  async history(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const service = new SubscriptionService(getTenantScopedClient(tenantId));
    const history = await service.listHistory(tenantId);
    sendSuccess(res, history);
  }

  private async runCheckout(req: TypedBodyRequest<CheckoutBody>, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const db = getTenantScopedClient(tenantId);
    const email = await currentUserEmail(req, db);
    const service = new SubscriptionService(db);

    const result = await service.checkout({
      tenantId,
      tenantName: req.tenant!.name,
      customerEmail: email,
      planSlug: req.body.planSlug,
      billingCycle: req.body.billingCycle,
      couponCode: req.body.couponCode,
      provider: req.body.provider,
      paymentToken: req.body.paymentToken,
      idempotencyKey: idempotencyKey(req),
    });
    sendSuccess(res, result, 'Subscription updated.', 201);
  }

  private async assertDirection(req: TypedBodyRequest<CheckoutBody>, direction: 'upgrade' | 'downgrade'): Promise<void> {
    const tenantId = req.tenant!.id;
    const service = new SubscriptionService(getTenantScopedClient(tenantId));
    const current = await service.getCurrent(tenantId);
    const targetPlan = await planRepository.findBySlug(req.body.planSlug);
    if (!targetPlan) throw new AppError(ErrorCode.VALIDATION_ERROR, 'The selected plan is not available.', 422);

    const isUpgrade = targetPlan.sortOrder > current.plan.sortOrder;
    if (direction === 'upgrade' && !isUpgrade) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'That plan is not an upgrade from your current plan.', 422);
    }
    if (direction === 'downgrade' && isUpgrade) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'That plan is not a downgrade from your current plan.', 422);
    }
  }
}

export const subscriptionController = new SubscriptionController();
