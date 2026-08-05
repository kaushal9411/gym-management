import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { MemberInvoiceRepository } from '../../finance/repositories/member-invoice.repository';
import { decryptMemberContact } from '../../members/utils/member-pii.util';
import { notifyPaymentFailed } from '../../tenant-notifications/services/notification-trigger.service';
import type { JobHandler } from '../types';

const DAY_MS = 86_400_000;
const DEDUPE_TTL_SECONDS = 3 * 86_400;

/** Members with an UNPAID/OVERDUE invoice due within 3 days — a friendly heads-up before it's actually late. */
export const paymentReminder: JobHandler = async () => {
  const windowEnd = new Date(Date.now() + 3 * DAY_MS);
  const invoices = (
    await prisma.memberInvoice.findMany({
      where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { gte: new Date(), lte: windowEnd } },
      include: { member: true, tenant: { select: { name: true } } },
    })
  ).map((invoice) => ({ ...invoice, member: decryptMemberContact(invoice.member) }));

  let reminded = 0;
  for (const invoice of invoices) {
    const dedupeKey = `notif:payment-reminder:${invoice.id}`;
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (daily) batch; no throughput requirement justifies parallelizing
    if (await cache.get(dedupeKey)) continue;
    if (invoice.member.email) {
      // eslint-disable-next-line no-await-in-loop
      await enqueueEmail({
        to: invoice.member.email,
        subject: `Payment reminder — invoice ${invoice.invoiceNumber}`,
        html: `<p>Hi ${invoice.member.firstName},</p><p>Your invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${invoice.totalAmount}</strong> at ${invoice.tenant.name} is due on ${invoice.dueDate.toISOString().slice(0, 10)}.</p>`,
      });
    }
    // eslint-disable-next-line no-await-in-loop
    await cache.set(dedupeKey, true, DEDUPE_TTL_SECONDS);
    reminded += 1;
  }
  return { scanned: invoices.length, reminded };
};

/** Member payments recorded as FAILED — nudges the member to retry, deduped so the same failed payment isn't re-nudged daily. */
export const failedPaymentRetry: JobHandler = async () => {
  const windowStart = new Date(Date.now() - 14 * DAY_MS);
  const payments = (
    await prisma.memberPayment.findMany({
      where: { status: 'FAILED', createdAt: { gte: windowStart } },
      include: { member: true },
    })
  ).map((payment) => ({ ...payment, member: decryptMemberContact(payment.member) }));

  let notified = 0;
  for (const payment of payments) {
    const dedupeKey = `notif:failed-payment-retry:${payment.id}`;
    // eslint-disable-next-line no-await-in-loop -- see paymentReminder
    if (await cache.get(dedupeKey)) continue;
    // eslint-disable-next-line no-await-in-loop
    await notifyPaymentFailed(payment.tenantId, {
      memberName: `${payment.member.firstName} ${payment.member.lastName}`.trim(),
      amount: payment.finalAmount.toString(),
      memberEmail: payment.member.email,
    });
    // eslint-disable-next-line no-await-in-loop
    await cache.set(dedupeKey, true, DEDUPE_TTL_SECONDS);
    notified += 1;
  }
  return { scanned: payments.length, notified };
};

const INVOICE_RENEWAL_WINDOW_DAYS = 7;

/**
 * Auto-generates a renewal invoice for ACTIVE memberships (not on `autoRenew`,
 * which is handled elsewhere) entering their renewal window, if one doesn't
 * already exist. Reuses `MemberInvoiceRepository`'s exact numbering/creation
 * logic (`finance` module) via a tenant-scoped client — same repository the
 * Finance UI's manual "Create Invoice" action uses, just triggered by a sweep
 * instead of a staff click.
 */
export const invoiceGeneration: JobHandler = async () => {
  const windowEnd = new Date(Date.now() + INVOICE_RENEWAL_WINDOW_DAYS * DAY_MS);
  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE', autoRenew: false, endDate: { gte: new Date(), lte: windowEnd } },
    include: { member: true, plan: true },
  });

  let generated = 0;
  for (const membership of memberships) {
    const dedupeKey = `invoice-generated:${membership.id}:${membership.endDate.toISOString().slice(0, 10)}`;
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (daily) batch; no throughput requirement justifies parallelizing
    if (await cache.get(dedupeKey)) continue;

    const db = getTenantScopedClient(membership.tenantId);
    const invoiceRepo = new MemberInvoiceRepository(db);
    // eslint-disable-next-line no-await-in-loop
    const invoiceNumber = await invoiceRepo.nextInvoiceNumber(membership.tenantId, 'INV');
    const unitPrice = Number(membership.plan.price);
    // eslint-disable-next-line no-await-in-loop
    await invoiceRepo.create(
      {
        tenantId: membership.tenantId,
        invoiceNumber,
        memberId: membership.memberId,
        branchId: membership.member.branchId,
        invoiceDate: new Date(),
        dueDate: membership.endDate,
        subtotal: unitPrice,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: unitPrice,
        status: 'UNPAID',
        notes: `Auto-generated renewal invoice for ${membership.plan.name} (Scheduler & Background Jobs module)`,
      },
      [{ description: `Membership renewal — ${membership.plan.name}`, quantity: 1, unitPrice }],
    );
    // eslint-disable-next-line no-await-in-loop
    await cache.set(dedupeKey, true, INVOICE_RENEWAL_WINDOW_DAYS * 2 * 86_400);
    generated += 1;
  }
  return { scanned: memberships.length, generated };
};

/** Escalation reminder for invoices that are genuinely overdue (past due date by 7+ days), separate window from `payment-reminder`'s "due soon" heads-up. */
export const outstandingPaymentReminder: JobHandler = async () => {
  const cutoff = new Date(Date.now() - 7 * DAY_MS);
  const invoices = (
    await prisma.memberInvoice.findMany({
      where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { lte: cutoff } },
      include: { member: true, tenant: { select: { name: true } } },
    })
  ).map((invoice) => ({ ...invoice, member: decryptMemberContact(invoice.member) }));

  let reminded = 0;
  for (const invoice of invoices) {
    const dedupeKey = `notif:outstanding-payment:${invoice.id}:${new Date().toISOString().slice(0, 10)}`;
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (weekly) batch; no throughput requirement justifies parallelizing
    if (await cache.get(dedupeKey)) continue;
    if (invoice.member.email) {
      // eslint-disable-next-line no-await-in-loop
      await enqueueEmail({
        to: invoice.member.email,
        subject: `Outstanding balance — invoice ${invoice.invoiceNumber}`,
        html: `<p>Hi ${invoice.member.firstName},</p><p>Your invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${invoice.totalAmount}</strong> at ${invoice.tenant.name} is now overdue (was due ${invoice.dueDate.toISOString().slice(0, 10)}). Please settle it at your earliest convenience.</p>`,
      });
    }
    // eslint-disable-next-line no-await-in-loop
    await cache.set(dedupeKey, true, 7 * 86_400);
    reminded += 1;
  }
  return { scanned: invoices.length, reminded };
};
