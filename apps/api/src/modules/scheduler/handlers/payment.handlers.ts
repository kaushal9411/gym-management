import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { sweepInvoiceDueSoon, sweepPaymentFailed, sweepPaymentOverdue } from '../../communications/services/automation-sweeps.service';
import { MemberInvoiceRepository } from '../../finance/repositories/member-invoice.repository';
import type { JobHandler } from '../types';

const DAY_MS = 86_400_000;

/**
 * Friendly heads-up before an invoice is late. Driven by the gym's `INVOICE_DUE_SOON` automation rule (default: 3 days
 * before the due date, push + email — the email keeps its detailed invoice layout); one reminder per invoice per timing.
 */
export const paymentReminder: JobHandler = async () => sweepInvoiceDueSoon();

/**
 * Nudges members whose payment attempt failed, the morning after. Driven by the gym's `PAYMENT_FAILED` automation rule
 * (default: 1 day after, push); one nudge per failed payment.
 */
export const failedPaymentRetry: JobHandler = async () => sweepPaymentFailed();

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

/**
 * Reminders for invoices that are genuinely overdue. Driven by the gym's `PAYMENT_OVERDUE` automation rule (default:
 * 1, 7 and 14 days after the due date, push + SMS; SMS only goes out where the gym has SMS enabled and within quota —
 * otherwise a skipped row is written to the Message Log). Runs daily so every timing is caught; each timing is sent once per invoice.
 */
export const outstandingPaymentReminder: JobHandler = async () => sweepPaymentOverdue();
