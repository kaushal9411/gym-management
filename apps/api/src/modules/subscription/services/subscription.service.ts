import { randomUUID } from 'node:crypto';

import type { SubscriptionHistoryAction } from '@prisma/client';

import { env } from '../../../config/env';
import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { BillingAddressRepository } from '../../billing/repositories/billing-address.repository';
import { CouponService } from '../../coupon/services/coupon.service';
import { createOrder, verifyOrderPaymentSignature } from '../../finance/services/razorpay-gateway.service';
import { InvoiceService } from '../../invoice/services/invoice.service';
import { planRepository } from '../../onboarding/repositories/plan.repository';
import { addBillingPeriod } from '../../onboarding/utils/billing-period';
import { PaymentMethodRepository } from '../../payment/repositories/payment-method.repository';
import type { PaymentGatewayProvider } from '../../payment/services/payment-gateway.service';
import { PaymentService } from '../../payment/services/payment.service';
import { fromGatewayEnum } from '../../payment/types/payment.types';
import { taxService } from '../../tax/services/tax.service';
import { tenantService } from '../../tenants/service/tenant.service';
import { SubscriptionRepository } from '../repositories/subscription.repository';

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface CheckoutInput {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  customerEmail: string;
  planSlug: string;
  billingCycle: BillingCycle;
  couponCode?: string;
  provider?: PaymentGatewayProvider;
  paymentToken?: string;
  idempotencyKey: string;
}

export interface StartCheckoutInput {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  customerEmail: string;
  planSlug: string;
  billingCycle: BillingCycle;
  couponCode?: string;
}

/**
 * Orchestrates the full "Payment Flow" diagram from Prompt 8: choose plan
 * → apply coupon → tax → gateway → invoice → activate → (email is fired by
 * the caller via eventBus, see billing.service.ts). Webhook verification
 * happens separately (see modules/webhook) since gateways call back
 * asynchronously rather than in this same request in the sandboxed setup.
 */
export class SubscriptionService {
  private readonly subscriptionRepository: SubscriptionRepository;
  private readonly couponService: CouponService;
  private readonly invoiceService: InvoiceService;
  private readonly paymentService: PaymentService;
  private readonly billingAddressRepository: BillingAddressRepository;
  private readonly paymentMethodRepository: PaymentMethodRepository;

  constructor(private readonly db: TenantScopedPrisma) {
    this.subscriptionRepository = new SubscriptionRepository(db);
    this.couponService = new CouponService(db);
    this.invoiceService = new InvoiceService(db);
    this.paymentService = new PaymentService(db);
    this.billingAddressRepository = new BillingAddressRepository(db);
    this.paymentMethodRepository = new PaymentMethodRepository(db);
  }

  async getCurrent(tenantId: string) {
    const subscription = await this.subscriptionRepository.findCurrent(tenantId);
    if (!subscription) throw new AppError(ErrorCode.NOT_FOUND, 'No subscription found for this tenant.', 404);
    return subscription;
  }

  /**
   * Used by `renew()` (the saved-card auto-renewal path — a cron job with
   * no interactive checkout form to redirect through) only. Interactive
   * self-service upgrade/downgrade from the Billing screen goes through
   * `startCheckoutLink`/`confirmCheckoutPayment` instead (a real Razorpay
   * Payment Link, not a card-number field this app never actually
   * validated or transmitted anywhere).
   */
  async checkout(input: CheckoutInput) {
    const priced = await this.priceChange(input.tenantId, input.planSlug, input.billingCycle, input.couponCode);
    const { plan, current, baseAmount, discountAmount, couponId, taxAmount, amountDue } = priced;
    const requiresPayment = amountDue > 0;

    if (requiresPayment) {
      if (!input.provider || !input.paymentToken) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Payment details are required for this plan.', 402);
      }
      await this.paymentService.charge({
        tenantId: input.tenantId,
        subscriptionId: current?.id ?? null,
        invoiceId: null,
        provider: input.provider,
        paymentToken: input.paymentToken,
        amount: amountDue,
        currency: plan.currency,
        customerEmail: input.customerEmail,
        description: `${plan.name} plan — ${input.billingCycle}`,
        idempotencyKey: input.idempotencyKey,
      });
    }

    const invoice = await this.invoiceService.generate({
      tenantId: input.tenantId,
      subscriptionId: current?.id ?? null,
      couponId,
      lineItems: [{ description: `${plan.name} plan (${input.billingCycle})`, quantity: 1, unitPrice: baseAmount, amount: baseAmount }],
      taxAmount,
      discountAmount,
      currency: plan.currency,
    });
    if (requiresPayment) await this.invoiceService.markPaid(invoice.id);

    const subscription = await this.activatePlan({
      tenantId: input.tenantId,
      tenantSlug: input.tenantSlug,
      tenantName: input.tenantName,
      customerEmail: input.customerEmail,
      plan,
      current,
      billingCycle: input.billingCycle,
      couponId,
      invoice,
    });

    return { subscription, invoice, plan };
  }

  /**
   * Interactive self-service "Create/Upgrade/Downgrade" — a free/fully-
   * discounted result activates immediately (nothing to collect); anything
   * with a balance due creates a real Razorpay Order for the client-side
   * Checkout modal (`checkout.js`, opened in-page — not a hosted redirect
   * page; no card details ever touch this app). `verifyCheckoutPayment`
   * completes the activation once the modal's success callback delivers a
   * signed payment/order pair.
   */
  async startCheckout(input: StartCheckoutInput) {
    const priced = await this.priceChange(input.tenantId, input.planSlug, input.billingCycle, input.couponCode);
    const { plan, current, baseAmount, discountAmount, couponId, taxAmount, amountDue } = priced;
    const requiresPayment = amountDue > 0;

    const invoice = await this.invoiceService.generate({
      tenantId: input.tenantId,
      subscriptionId: current?.id ?? null,
      couponId,
      lineItems: [{ description: `${plan.name} plan (${input.billingCycle})`, quantity: 1, unitPrice: baseAmount, amount: baseAmount }],
      taxAmount,
      discountAmount,
      currency: plan.currency,
    });

    if (!requiresPayment) {
      await this.invoiceService.markPaid(invoice.id);
      const subscription = await this.activatePlan({
        tenantId: input.tenantId,
        tenantSlug: input.tenantSlug,
        tenantName: input.tenantName,
        customerEmail: input.customerEmail,
        plan,
        current,
        billingCycle: input.billingCycle,
        couponId,
        invoice,
      });
      return { requiresPayment: false as const, subscription, invoice, plan };
    }

    const idempotencyKey = randomUUID();
    const payment = await this.db.payment.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: current?.id ?? null,
        invoiceId: invoice.id,
        provider: 'RAZORPAY',
        status: 'PENDING',
        amount: amountDue,
        currency: plan.currency,
        idempotencyKey,
        metadata: { planSlug: input.planSlug, billingCycle: input.billingCycle, couponId },
      },
    });

    const order = await createOrder({
      amountInSmallestUnit: Math.round(amountDue * 100),
      currency: plan.currency,
      receipt: invoice.invoiceNumber,
      notes: { platformPaymentId: payment.id, tenantId: input.tenantId },
    });
    await this.db.payment.update({ where: { id: payment.id }, data: { gatewayReference: order.id } });

    return {
      requiresPayment: true as const,
      paymentId: payment.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpay.keyId!,
      invoice,
      plan,
    };
  }

  /**
   * Called by the Billing screen once Razorpay's Checkout modal fires its
   * success handler — verifies the `orderId|paymentId` HMAC signature
   * (pure local computation, no Razorpay API call) before activating
   * anything, so a forged/tampered client callback can't self-approve a
   * plan change.
   */
  async verifyCheckoutPayment(input: {
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    customerEmail: string;
    paymentId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const payment = await this.db.payment.findFirst({ where: { id: input.paymentId, tenantId: input.tenantId } });
    if (!payment) throw new AppError(ErrorCode.NOT_FOUND, 'Payment not found.', 404);
    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') return { status: payment.status };
    if (payment.gatewayReference !== input.razorpayOrderId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This payment does not match the order being verified.', 400);
    }

    const valid = verifyOrderPaymentSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });

    if (!valid) {
      await this.db.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Signature verification failed.' } });
      eventBus.emitEvent('billing.payment_failed', { tenantId: input.tenantId, paymentId: payment.id });
      return { status: 'FAILED' as const };
    }

    const updated = await this.db.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCEEDED', gatewayReference: input.razorpayPaymentId },
    });
    if (updated.invoiceId) await this.invoiceService.markPaid(updated.invoiceId);
    const invoice = updated.invoiceId ? await this.db.invoice.findUnique({ where: { id: updated.invoiceId } }) : null;
    const metadata = updated.metadata as { planSlug?: string; billingCycle?: BillingCycle; couponId?: string | null } | null;

    if (invoice && metadata?.planSlug && metadata.billingCycle) {
      const plan = await planRepository.findBySlug(metadata.planSlug);
      if (!plan) throw new AppError(ErrorCode.NOT_FOUND, 'Plan not found.', 404);
      const current = await this.subscriptionRepository.findCurrent(input.tenantId);
      const subscription = await this.activatePlan({
        tenantId: input.tenantId,
        tenantSlug: input.tenantSlug,
        tenantName: input.tenantName,
        customerEmail: input.customerEmail,
        plan,
        current,
        billingCycle: metadata.billingCycle,
        couponId: metadata.couponId ?? null,
        invoice,
      });
      return { status: 'SUCCEEDED' as const, subscription };
    }
    return { status: 'SUCCEEDED' as const };
  }

  /** Coupon + tax pricing shared by `checkout`/`startCheckoutLink` — the only difference between them is what happens once `amountDue` is known. */
  private async priceChange(tenantId: string, planSlug: string, billingCycle: BillingCycle, couponCode?: string) {
    const plan = await planRepository.findBySlug(planSlug);
    if (!plan || !plan.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, 'The selected plan is not available.', 422);

    const current = await this.subscriptionRepository.findCurrent(tenantId);
    const baseAmount = billingCycle === 'YEARLY' ? Number(plan.priceYearly) : Number(plan.priceMonthly);

    let discountAmount = 0;
    let couponId: string | null = null;
    if (couponCode) {
      const coupon = await this.couponService.redeem(couponCode, tenantId);
      const priced = this.couponService.priceWith(coupon, baseAmount);
      discountAmount = priced.discountAmount;
      couponId = coupon.id;
    }

    const address = await this.billingAddressRepository.find(tenantId);
    const tax = address ? await taxService.calculate(address.country, address.state, baseAmount - discountAmount) : { ratePercent: 0, taxAmount: 0, label: null };
    const amountDue = Math.max(baseAmount - discountAmount + tax.taxAmount, 0);

    return { plan, current, baseAmount, discountAmount, couponId, taxAmount: tax.taxAmount, amountDue };
  }

  /**
   * The actual plan switch + activation — subscription upsert, history,
   * tenant status mirror, limit/module sync, cache invalidate, event emit.
   * Shared by the sandboxed saved-card path (`checkout`), a free/fully-
   * discounted self-service change, and a Razorpay-Payment-Link-confirmed
   * self-service change — all three need the exact same tail once the
   * money side (or lack of it) is settled.
   */
  private async activatePlan(params: {
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    customerEmail: string;
    plan: NonNullable<Awaited<ReturnType<typeof planRepository.findBySlug>>>;
    current: Awaited<ReturnType<SubscriptionRepository['findCurrent']>>;
    billingCycle: BillingCycle;
    couponId: string | null;
    invoice: { id: string; invoiceNumber: string; total: unknown; currency: string };
  }) {
    const { tenantId, tenantSlug, tenantName, customerEmail, plan, current, billingCycle, couponId, invoice } = params;
    const now = new Date();
    const currentPeriodEnd = addBillingPeriod(now, billingCycle);
    const action: SubscriptionHistoryAction = !current
      ? 'CREATED'
      : plan.id === current.planId
        ? 'RENEWED'
        : plan.sortOrder > current.plan.sortOrder
          ? 'UPGRADED'
          : 'DOWNGRADED';

    const subscription = current
      ? await this.subscriptionRepository.update(current.id, {
          planId: plan.id,
          couponId,
          status: 'ACTIVE',
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          graceEndsAt: null,
          suspendedAt: null,
          cancelledAt: null,
          cancelReason: null,
        })
      : await this.db.subscription.create({
          data: { tenantId, planId: plan.id, couponId, status: 'ACTIVE', billingCycle, currentPeriodStart: now, currentPeriodEnd },
        });

    await this.subscriptionRepository.recordHistory({
      tenantId,
      subscriptionId: subscription.id,
      fromPlanId: current?.planId ?? null,
      toPlanId: plan.id,
      fromStatus: current?.status ?? null,
      toStatus: 'ACTIVE',
      action,
    });

    // Tenant.status/subscriptionExpiresAt/suspendedAt is the fast-path cache
    // tenantMiddleware gates every request on (see tenant.service.ts's
    // assertTenantAccessible) — must stay in lockstep with Subscription.status.
    await this.db.tenant.update({
      where: { id: tenantId },
      data: { status: 'ACTIVE', subscriptionExpiresAt: null, suspendedAt: null },
    });

    // Same limit/module sync the Super Admin's own plan-change path already
    // does (admin-tenant-billing.service.ts) — without this, a self-service
    // checkout "succeeds" but the tenant's actual enforced caps and
    // feature-gated nav/menu items silently stay on whatever they were
    // before (confirmed live: a tenant subscribing to a plan from scratch
    // kept an empty `featureFlags`, hiding most of the app). Upsert rather
    // than update — this tenant may have no TenantLimit/TenantModule rows
    // yet if it never went through onboarding provisioning.
    await this.db.tenantLimit.upsert({
      where: { tenantId },
      create: {
        tenantId,
        maxBranches: plan.maxBranches,
        maxManagers: plan.maxManagers,
        maxTrainers: plan.maxTrainers,
        maxReceptionists: plan.maxReceptionists,
        maxStaff: plan.maxStaff,
        maxMembers: plan.maxMembers,
        maxStorageMb: plan.maxStorageMb,
      },
      update: {
        maxBranches: plan.maxBranches,
        maxManagers: plan.maxManagers,
        maxTrainers: plan.maxTrainers,
        maxReceptionists: plan.maxReceptionists,
        maxStaff: plan.maxStaff,
        maxMembers: plan.maxMembers,
        maxStorageMb: plan.maxStorageMb,
      },
    });
    for (const feature of plan.features) {
      // eslint-disable-next-line no-await-in-loop -- plan feature lists are small (~25 rows) and this is not a request-path hot loop
      await this.db.tenantModule.upsert({
        where: { tenantId_key: { tenantId, key: feature.key } },
        create: { tenantId, key: feature.key, enabled: feature.included },
        update: { enabled: feature.included },
      });
    }
    // Both writes above (and the Tenant.status write before them) feed the
    // same 5-minute cache-aside ResolvedTenant read every request goes
    // through — without this, the new limits/featureFlags silently don't
    // take effect until that cache expires.
    await tenantService.invalidateCache(tenantSlug, tenantId);

    eventBus.emitEvent('billing.subscription_activated', {
      tenantId,
      tenantName,
      email: customerEmail,
      planName: plan.name,
      action,
      invoiceNumber: invoice.invoiceNumber,
      invoiceId: invoice.id,
      total: Number(invoice.total),
      currency: invoice.currency,
    });

    return subscription;
  }

  async cancel(tenantId: string, immediate: boolean, reason?: string) {
    const current = await this.getCurrent(tenantId);
    const now = new Date();

    const updated = await this.subscriptionRepository.update(current.id, immediate
      ? { status: 'CANCELED', cancelledAt: now, cancelReason: reason, cancelAtPeriodEnd: false }
      : { cancelAtPeriodEnd: true, cancelReason: reason },
    );

    await this.subscriptionRepository.recordHistory({
      tenantId,
      subscriptionId: current.id,
      fromPlanId: current.planId,
      toPlanId: current.planId,
      fromStatus: current.status,
      toStatus: immediate ? 'CANCELED' : current.status,
      action: 'CANCELLED',
      note: reason,
    });

    if (immediate) {
      await this.db.tenant.update({ where: { id: tenantId }, data: { status: 'CANCELLED', suspendedAt: now } });
    }

    return updated;
  }

  /**
   * Renews using the tenant's saved default payment method — used by the
   * "Renew Subscription" endpoint and the renewal/payment-retry queue jobs,
   * neither of which has a fresh card token from a live checkout form.
   */
  async renew(tenantId: string, tenantSlug: string, tenantName: string, customerEmail: string, idempotencyKey: string) {
    const current = await this.getCurrent(tenantId);
    const defaultMethod = await this.paymentMethodRepository.findDefault(tenantId);
    if (!defaultMethod) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'No saved payment method on file to renew with.', 402);
    }

    return this.checkout({
      tenantId,
      tenantSlug,
      tenantName,
      customerEmail,
      planSlug: current.plan.slug,
      billingCycle: current.billingCycle,
      provider: fromGatewayEnum(defaultMethod.provider),
      paymentToken: defaultMethod.gatewayMethodId,
      idempotencyKey,
    });
  }

  async listHistory(tenantId: string) {
    const current = await this.getCurrent(tenantId);
    return this.subscriptionRepository.listHistory(tenantId, current.id);
  }
}
