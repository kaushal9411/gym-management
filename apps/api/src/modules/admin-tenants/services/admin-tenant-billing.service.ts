import { randomUUID } from 'node:crypto';

import type { SubscriptionHistoryAction } from '@prisma/client';

import { env } from '../../../config/env';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { invoiceEmail } from '../../../infrastructure/mail/templates/billing-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminPaymentRepository } from '../../admin-payments/repositories/admin-payment.repository';
import { adminPlanRepository } from '../../admin-plans/repositories/admin-plan.repository';
import { createPaymentLink, fetchPaymentLink, notifyPaymentLink } from '../../finance/services/razorpay-gateway.service';
import { InvoiceService } from '../../invoice/services/invoice.service';
import { addBillingPeriod } from '../../onboarding/utils/billing-period';
import { SubscriptionRepository } from '../../subscription/repositories/subscription.repository';
import { adminTenantRepository } from '../repositories/admin-tenant.repository';

export type ChangePlanMode = 'manual' | 'payment_link';

function portalPath(tenantSlug: string, path: string): string {
  return `http://${tenantSlug}.${env.platformDomain}${path}`;
}

/**
 * Platform billing actions for a single tenant, driven from the Super Admin
 * Tenant Detail page — FitCloud collecting a payment FROM a tenant for its
 * own subscription. Deliberately separate from `modules/finance` (a gym
 * collecting payments from its OWN members) — no shared code, different
 * money movement, reuses only the generic `razorpay-gateway.service.ts`
 * wrapper (which has no member-specific coupling).
 */
export class AdminTenantBillingService {
  private readonly db: TenantScopedPrisma;
  private readonly subscriptions: SubscriptionRepository;
  private readonly invoices: InvoiceService;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.subscriptions = new SubscriptionRepository(this.db);
    this.invoices = new InvoiceService(this.db);
  }

  async payments(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const { total, items } = await adminPaymentRepository.list({ tenantId: this.tenantId, skip, take: limit });
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async invoiceList(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const { total, items } = await adminPaymentRepository.listInvoices({ tenantId: this.tenantId, skip, take: limit });
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Creates (or reuses) a real Razorpay Payment Link for the tenant's
   * outstanding invoice. `Payment.invoiceId` is `@unique` — a second
   * `create()` against an invoice that already has a row would 500 on the
   * DB constraint, so an existing row is always reused/refreshed instead.
   */
  async createPaymentLink(input: { invoiceId?: string; planId?: string }, adminUserId: string, adminRole: string) {
    const metadata: Record<string, string> = {};
    let invoice: Awaited<ReturnType<typeof this.mustFindInvoice>>;

    if (input.planId) {
      // A plan CHANGE is always a fresh invoice for the new plan's price —
      // never reuses an existing open invoice, which would be for the old plan's amount.
      invoice = await this.generatePlanChangeInvoice(input.planId);
      metadata.targetPlanId = input.planId;
    } else {
      invoice = input.invoiceId ? await this.mustFindInvoice(input.invoiceId) : await this.findOrCreateOpenInvoice();
    }
    if (invoice.status === 'PAID') throw new ConflictError(ErrorCode.CONFLICT, 'This invoice is already paid.');
    if (invoice.status === 'VOID') throw new ConflictError(ErrorCode.CONFLICT, 'This invoice has been voided.');

    const owner = await adminTenantRepository.findOwner(this.tenantId);
    if (!owner) throw new NotFoundError('No owner account found for this tenant.');
    const tenant = await adminTenantRepository.findById(this.tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found.');

    const existing = await this.db.payment.findUnique({ where: { invoiceId: invoice.id } });
    if (existing?.status === 'SUCCEEDED') throw new ConflictError(ErrorCode.CONFLICT, 'This invoice has already been paid.');

    let payment = existing;
    if (existing && existing.status === 'PENDING' && existing.gatewayReference) {
      const link = await fetchPaymentLink(existing.gatewayReference);
      await adminAuditLogRepository.record({
        adminUserId,
        actorRole: adminRole,
        action: 'admin.tenant_payment_link_created',
        entityType: 'Tenant',
        entityId: this.tenantId,
      });
      return { paymentId: existing.id, invoiceId: invoice.id, shortUrl: link.shortUrl, status: existing.status };
    }

    const idempotencyKey = randomUUID();
    if (existing) {
      payment = await this.db.payment.update({
        where: { id: existing.id },
        data: { status: 'PENDING', failureReason: null, idempotencyKey, provider: 'RAZORPAY', amount: invoice.total, currency: invoice.currency, metadata },
      });
    } else {
      payment = await this.db.payment.create({
        data: {
          tenantId: this.tenantId,
          subscriptionId: invoice.subscriptionId,
          invoiceId: invoice.id,
          provider: 'RAZORPAY',
          status: 'PENDING',
          amount: invoice.total,
          currency: invoice.currency,
          idempotencyKey,
          metadata,
        },
      });
    }

    const link = await createPaymentLink({
      amountInSmallestUnit: Math.round(Number(invoice.total) * 100),
      currency: invoice.currency,
      description: `FitCloud invoice ${invoice.invoiceNumber}`,
      referenceId: invoice.invoiceNumber,
      customerName: owner.name,
      customerEmail: owner.email,
      notifyEmail: true,
      notifySms: false,
      notes: { platformPaymentId: payment!.id, tenantId: this.tenantId },
    });
    await this.db.payment.update({ where: { id: payment!.id }, data: { gatewayReference: link.id } });

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: input.planId ? 'admin.tenant_plan_change_link_created' : 'admin.tenant_payment_link_created',
      entityType: 'Tenant',
      entityId: this.tenantId,
    });

    return { paymentId: payment!.id, invoiceId: invoice.id, shortUrl: link.shortUrl, status: 'PENDING' as const };
  }

  /** Single entry point for "Upgrade/Downgrade" from the Plan Detail page's subscriber list — dispatches to a same-session admin override or a real Razorpay collection. */
  async changePlan(planId: string, mode: ChangePlanMode, adminUserId: string, adminRole: string) {
    if (mode === 'manual') return this.changePlanManually(planId, adminUserId, adminRole);
    return this.createPaymentLink({ planId }, adminUserId, adminRole);
  }

  /**
   * Admin-asserted plan switch with no online payment collected (e.g. the
   * gym paid via bank transfer, or this is a comp/support override) —
   * mirrors `SubscriptionService.checkout()`'s exact success tail, generating
   * and immediately marking an invoice PAID rather than going through the
   * (sandboxed) charge step, since there's no real gateway call to make here.
   */
  private async changePlanManually(planId: string, adminUserId: string, adminRole: string) {
    const invoice = await this.generatePlanChangeInvoice(planId);
    await this.invoices.markPaid(invoice.id);
    await this.applyPlanChange(planId, invoice, 'Manually changed by admin (no online payment collected)');

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.tenant_plan_changed_manual',
      entityType: 'Tenant',
      entityId: this.tenantId,
      after: { planId },
    });

    return this.subscriptions.findCurrent(this.tenantId);
  }

  /** No public webhook URL in local dev — same manual-poll integration seam Member Payments uses. */
  async verifyPaymentStatus(paymentId: string, adminUserId: string, adminRole: string) {
    const payment = await this.mustFindPayment(paymentId);
    if (payment.status !== 'PENDING' || !payment.gatewayReference) {
      return { status: payment.status };
    }

    const link = await fetchPaymentLink(payment.gatewayReference);

    if (link.status === 'paid') {
      const updated = await this.db.payment.update({
        where: { id: paymentId },
        data: { status: 'SUCCEEDED', gatewayReference: link.razorpayPaymentId ?? payment.gatewayReference },
      });
      if (payment.invoiceId) await this.invoices.markPaid(payment.invoiceId);
      await this.reactivateAfterPayment(updated);
      await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.tenant_payment_link_paid', entityType: 'Tenant', entityId: this.tenantId });
      return { status: 'SUCCEEDED' as const };
    }

    if (link.status === 'expired' || link.status === 'cancelled') {
      await this.db.payment.update({ where: { id: paymentId }, data: { status: 'FAILED', failureReason: `Razorpay link ${link.status}` } });
      eventBus.emitEvent('billing.payment_failed', { tenantId: this.tenantId, paymentId });
      await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.tenant_payment_link_failed', entityType: 'Tenant', entityId: this.tenantId });
      return { status: 'FAILED' as const };
    }

    return { status: 'PENDING' as const };
  }

  /** Staff-triggered resend of Razorpay's own notification — doesn't cancel/recreate the link. */
  async resendNotification(paymentId: string, medium: 'email' | 'sms', adminUserId: string, adminRole: string) {
    const payment = await this.mustFindPayment(paymentId);
    if (payment.status !== 'PENDING' || !payment.gatewayReference) {
      throw new ConflictError(ErrorCode.CONFLICT, 'This payment has no active payment link to resend.');
    }
    await notifyPaymentLink(payment.gatewayReference, medium);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: `admin.tenant_payment_link_resent_${medium}`, entityType: 'Tenant', entityId: this.tenantId });
  }

  async downloadInvoicePdf(invoiceId: string): Promise<Buffer> {
    const tenant = await adminTenantRepository.findById(this.tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found.');
    return this.invoices.renderPdf(this.tenantId, invoiceId, tenant.name);
  }

  async emailInvoice(invoiceId: string, adminUserId: string, adminRole: string, overrideEmail?: string) {
    const invoice = await this.mustFindInvoice(invoiceId);
    const tenant = await adminTenantRepository.findById(this.tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found.');
    const owner = await adminTenantRepository.findOwner(this.tenantId);
    const to = overrideEmail ?? owner?.email;
    if (!to) throw new ValidationError('This tenant has no owner email on file — provide one explicitly.');

    const totalFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(Number(invoice.total));
    const downloadUrl = portalPath(tenant.slug, `/billing/invoices/${invoice.id}`);
    const template = invoiceEmail({ tenantName: tenant.name }, owner?.name ?? 'there', invoice.invoiceNumber, totalFormatted, downloadUrl);
    await enqueueEmail({ to, subject: template.subject, html: template.html });

    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.tenant_invoice_emailed', entityType: 'Tenant', entityId: this.tenantId });
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFindPayment(paymentId: string) {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, tenantId: this.tenantId } });
    if (!payment) throw new NotFoundError('Payment not found.');
    return payment;
  }

  private async mustFindInvoice(invoiceId: string) {
    const invoice = await this.db.invoice.findFirst({ where: { id: invoiceId, tenantId: this.tenantId } });
    if (!invoice) throw new NotFoundError('Invoice not found.');
    return invoice;
  }

  /** Renewal-lifecycle jobs can move a subscription to PAST_DUE/GRACE/SUSPENDED without generating a new Invoice when there's no saved payment method — auto-generate one against the current plan/cycle so "Send Payment Link" always has something to charge. */
  private async findOrCreateOpenInvoice() {
    const open = await this.db.invoice.findFirst({ where: { tenantId: this.tenantId, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
    if (open) return open;

    const subscription = await this.subscriptions.findCurrent(this.tenantId);
    if (!subscription) throw new AppError(ErrorCode.VALIDATION_ERROR, 'This tenant has no subscription to bill.', 422);

    const amount = subscription.billingCycle === 'YEARLY' ? Number(subscription.plan.priceYearly) : Number(subscription.plan.priceMonthly);
    return this.invoices.generate({
      tenantId: this.tenantId,
      subscriptionId: subscription.id,
      couponId: null,
      lineItems: [{ description: `${subscription.plan.name} plan (${subscription.billingCycle})`, quantity: 1, unitPrice: amount, amount }],
      taxAmount: 0,
      discountAmount: 0,
      currency: subscription.plan.currency,
    });
  }

  /** Same shape as `findOrCreateOpenInvoice`, but always a FRESH invoice for the target plan's price — never reuses an existing open invoice, which would be for the old plan's amount. */
  private async generatePlanChangeInvoice(planId: string) {
    const targetPlan = await adminPlanRepository.findById(planId);
    if (!targetPlan) throw new NotFoundError('Plan not found.');
    if (!targetPlan.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, 'This plan is disabled and cannot be assigned.', 422);

    const current = await this.subscriptions.findCurrent(this.tenantId);
    const billingCycle = current?.billingCycle ?? 'MONTHLY';
    const amount = billingCycle === 'YEARLY' ? Number(targetPlan.priceYearly) : Number(targetPlan.priceMonthly);

    return this.invoices.generate({
      tenantId: this.tenantId,
      subscriptionId: current?.id ?? null,
      couponId: null,
      lineItems: [{ description: `${targetPlan.name} plan (${billingCycle})`, quantity: 1, unitPrice: amount, amount }],
      taxAmount: 0,
      discountAmount: 0,
      currency: targetPlan.currency,
    });
  }

  /**
   * The actual plan switch + activation — mirrors `SubscriptionService.checkout()`'s
   * exact success tail (period roll, status, tenant mirror, history, event),
   * generalized to also handle a tenant with NO subscription yet ("assign a
   * fresh plan") via the same `current ? update : create` branch `checkout()`
   * uses. Shared by the manual-override path and the paid-payment-link path —
   * a plain renewal is just this same call with `planId === current.planId`.
   */
  private async applyPlanChange(planId: string, invoice: { id: string; invoiceNumber: string; total: unknown; currency: string }, note: string) {
    const targetPlan = await adminPlanRepository.findById(planId);
    if (!targetPlan) throw new NotFoundError('Plan not found.');

    const current = await this.subscriptions.findCurrent(this.tenantId);
    const now = new Date();
    const billingCycle = current?.billingCycle ?? 'MONTHLY';
    const currentPeriodEnd = addBillingPeriod(now, billingCycle);

    const action: SubscriptionHistoryAction = !current
      ? 'CREATED'
      : targetPlan.id === current.planId
        ? 'RENEWED'
        : targetPlan.sortOrder > current.plan.sortOrder
          ? 'UPGRADED'
          : 'DOWNGRADED';

    const subscription = current
      ? await this.subscriptions.update(current.id, {
          planId: targetPlan.id,
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
          data: { tenantId: this.tenantId, planId: targetPlan.id, status: 'ACTIVE', billingCycle, currentPeriodStart: now, currentPeriodEnd },
        });

    await this.subscriptions.recordHistory({
      tenantId: this.tenantId,
      subscriptionId: subscription.id,
      fromPlanId: current?.planId ?? null,
      toPlanId: targetPlan.id,
      fromStatus: current?.status ?? null,
      toStatus: 'ACTIVE',
      action,
      note,
    });

    // Tenant.status/subscriptionExpiresAt/suspendedAt is the fast-path cache
    // tenantMiddleware gates every request on — must stay in lockstep.
    await this.db.tenant.update({ where: { id: this.tenantId }, data: { status: 'ACTIVE', subscriptionExpiresAt: null, suspendedAt: null } });

    const owner = await adminTenantRepository.findOwner(this.tenantId);
    const tenant = await adminTenantRepository.findById(this.tenantId);
    if (owner && tenant) {
      eventBus.emitEvent('billing.subscription_activated', {
        tenantId: this.tenantId,
        tenantName: tenant.name,
        email: owner.email,
        planName: targetPlan.name,
        action,
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id,
        total: Number(invoice.total),
        currency: invoice.currency,
      });
    }

    return subscription;
  }

  /** Mirrors `SubscriptionService.checkout()`'s success tail for a paid Razorpay link — a plain renewal (no plan change requested) is just `applyPlanChange` targeting the tenant's own current plan. */
  private async reactivateAfterPayment(payment: { invoiceId: string | null; metadata: unknown }): Promise<void> {
    if (!payment.invoiceId) return;
    const invoice = await this.db.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!invoice) return;

    const targetPlanId = (payment.metadata as Record<string, unknown> | null)?.targetPlanId as string | undefined;
    const current = await this.subscriptions.findCurrent(this.tenantId);
    const planId = targetPlanId ?? current?.planId;
    if (!planId) return;

    await this.applyPlanChange(planId, invoice, 'Paid via admin-generated Razorpay payment link');
  }
}
