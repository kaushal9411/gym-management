import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { BillingAddressRepository } from '../../billing/repositories/billing-address.repository';
import { CouponService } from '../../coupon/services/coupon.service';
import { InvoiceService } from '../../invoice/services/invoice.service';
import { planRepository } from '../../onboarding/repositories/plan.repository';
import { addBillingPeriod } from '../../onboarding/utils/billing-period';
import { PaymentMethodRepository } from '../../payment/repositories/payment-method.repository';
import type { PaymentGatewayProvider } from '../../payment/services/payment-gateway.service';
import { PaymentService } from '../../payment/services/payment.service';
import { fromGatewayEnum } from '../../payment/types/payment.types';
import { taxService } from '../../tax/services/tax.service';
import { SubscriptionRepository } from '../repositories/subscription.repository';

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface CheckoutInput {
  tenantId: string;
  tenantName: string;
  customerEmail: string;
  planSlug: string;
  billingCycle: BillingCycle;
  couponCode?: string;
  provider?: PaymentGatewayProvider;
  paymentToken?: string;
  idempotencyKey: string;
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

  /** Used by both "Create Subscription" (no existing paid plan yet) and "Upgrade/Downgrade" (an existing one). */
  async checkout(input: CheckoutInput) {
    const plan = await planRepository.findBySlug(input.planSlug);
    if (!plan || !plan.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, 'The selected plan is not available.', 422);

    const current = await this.subscriptionRepository.findCurrent(input.tenantId);
    const baseAmount = input.billingCycle === 'YEARLY' ? Number(plan.priceYearly) : Number(plan.priceMonthly);

    let discountAmount = 0;
    let couponId: string | null = null;
    if (input.couponCode) {
      const coupon = await this.couponService.redeem(input.couponCode, input.tenantId);
      const priced = this.couponService.priceWith(coupon, baseAmount);
      discountAmount = priced.discountAmount;
      couponId = coupon.id;
    }

    const address = await this.billingAddressRepository.find(input.tenantId);
    const tax = address ? await taxService.calculate(address.country, address.state, baseAmount - discountAmount) : { ratePercent: 0, taxAmount: 0, label: null };

    const amountDue = Math.max(baseAmount - discountAmount + tax.taxAmount, 0);
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
      taxAmount: tax.taxAmount,
      discountAmount,
      currency: plan.currency,
    });
    if (requiresPayment) await this.invoiceService.markPaid(invoice.id);

    const now = new Date();
    const currentPeriodEnd = addBillingPeriod(now, input.billingCycle);
    const action = !current
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
          billingCycle: input.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          graceEndsAt: null,
          suspendedAt: null,
          cancelledAt: null,
          cancelReason: null,
        })
      : await this.db.subscription.create({
          data: {
            tenantId: input.tenantId,
            planId: plan.id,
            couponId,
            status: 'ACTIVE',
            billingCycle: input.billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd,
          },
        });

    await this.subscriptionRepository.recordHistory({
      tenantId: input.tenantId,
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
      where: { id: input.tenantId },
      data: { status: 'ACTIVE', subscriptionExpiresAt: null, suspendedAt: null },
    });

    eventBus.emitEvent('billing.subscription_activated', {
      tenantId: input.tenantId,
      tenantName: input.tenantName,
      email: input.customerEmail,
      planName: plan.name,
      action,
      invoiceNumber: invoice.invoiceNumber,
      invoiceId: invoice.id,
      total: Number(invoice.total),
      currency: invoice.currency,
    });

    return { subscription, invoice, plan };
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
  async renew(tenantId: string, tenantName: string, customerEmail: string, idempotencyKey: string) {
    const current = await this.getCurrent(tenantId);
    const defaultMethod = await this.paymentMethodRepository.findDefault(tenantId);
    if (!defaultMethod) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'No saved payment method on file to renew with.', 402);
    }

    return this.checkout({
      tenantId,
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
