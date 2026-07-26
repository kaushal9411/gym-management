import ExcelJS from 'exceljs';

import { ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { notifyPaymentFailed, notifyPaymentReceived } from '../../tenant-notifications/services/notification-trigger.service';
import type {
  CreatePaymentInput,
  ListPaymentsQuery,
  MemberPaymentDetailDto,
  MemberPaymentListItemDto,
  RefundPaymentInput,
  UpdatePaymentInput,
} from '../dto/finance.dto';
import { MemberPaymentRepository, type MemberPaymentDetailRow, type MemberPaymentListRow } from '../repositories/member-payment.repository';

import { MemberInvoiceService } from './member-invoice.service';

function toListDto(row: MemberPaymentListRow): MemberPaymentListItemDto {
  return {
    id: row.id,
    paymentNumber: row.paymentNumber,
    member: { id: row.member.id, memberId: row.member.memberId, name: `${row.member.firstName} ${row.member.lastName}`.trim() },
    branch: { id: row.branch.id, name: row.branch.name },
    membership: row.membership ? { id: row.membership.id, planName: row.membership.plan.name } : null,
    invoiceId: row.invoiceId,
    amount: row.amount.toString(),
    discount: row.discount.toString(),
    tax: row.tax.toString(),
    finalAmount: row.finalAmount.toString(),
    method: row.method,
    paymentDate: row.paymentDate.toISOString().slice(0, 10),
    transactionReference: row.transactionReference,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetailDto(row: MemberPaymentDetailRow): MemberPaymentDetailDto {
  const totalRefunded = row.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  return {
    ...toListDto(row),
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
    recordedBy: row.recordedByUser ? { id: row.recordedByUser.id, name: row.recordedByUser.name } : null,
    refunds: row.refunds.map((r) => ({
      id: r.id,
      amount: r.amount.toString(),
      reason: r.reason,
      refundedBy: r.refundedByUser ? { id: r.refundedByUser.id, name: r.refundedByUser.name } : null,
      refundedAt: r.refundedAt.toISOString(),
    })),
    totalRefunded: totalRefunded.toFixed(2),
  };
}

export class MemberPaymentService {
  private readonly db: TenantScopedPrisma;
  private readonly payments: MemberPaymentRepository;
  private readonly invoiceService: MemberInvoiceService;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.payments = new MemberPaymentRepository(this.db);
    this.invoiceService = new MemberInvoiceService(tenantId);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(query: ListPaymentsQuery) {
    const { items, total } = await this.payments.list(this.tenantId, query);
    return { items: items.map(toListDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async getById(id: string): Promise<MemberPaymentDetailDto> {
    return toDetailDto(await this.mustFind(id));
  }

  async create(input: CreatePaymentInput, actor: IamActor): Promise<MemberPaymentDetailDto> {
    const member = await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: input.memberId, deletedAt: null } });
    if (!member) throw new NotFoundError('Member not found.');
    const branchId = input.branchId ?? member.branchId;

    if (input.membershipId) {
      const membership = await this.db.membership.findFirst({ where: { tenantId: this.tenantId, id: input.membershipId, memberId: input.memberId } });
      if (!membership) throw new NotFoundError('Membership not found for this member.');
    }

    let invoice = null;
    if (input.invoiceId) {
      invoice = await this.db.memberInvoice.findFirst({ where: { tenantId: this.tenantId, id: input.invoiceId } });
      if (!invoice) throw new NotFoundError('Invoice not found.');
      // Business rule: prevent duplicate payments for the same invoice.
      const existing = await this.payments.findActiveByInvoice(this.tenantId, input.invoiceId);
      if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'This invoice already has an active payment recorded against it.');
    }

    const discount = input.discount ?? 0;
    const tax = input.tax ?? 0;
    const finalAmount = Math.max(input.amount - discount + tax, 0);
    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const status = input.status ?? 'SUCCESS';
    const paymentNumber = await this.payments.nextPaymentNumber(this.tenantId);

    const payment = await this.payments.create({
      tenantId: this.tenantId,
      paymentNumber,
      memberId: input.memberId,
      membershipId: input.membershipId,
      invoiceId: input.invoiceId,
      branchId,
      amount: input.amount,
      discount,
      tax,
      finalAmount,
      method: input.method,
      paymentDate,
      transactionReference: input.transactionReference,
      status,
      notes: input.notes,
      recordedBy: actor.userId,
    });
    await this.audit(actor, 'member_payment.created', payment.id);

    if (status === 'SUCCESS') {
      await this.onPaymentSucceeded(payment, member, branchId);
    } else if (status === 'FAILED') {
      await notifyPaymentFailed(this.tenantId, {
        memberName: `${member.firstName} ${member.lastName}`.trim(),
        amount: Number(payment.finalAmount).toFixed(2),
        memberEmail: member.email,
      });
    }
    return toDetailDto((await this.payments.findById(this.tenantId, payment.id))!);
  }

  async update(id: string, input: UpdatePaymentInput, actor: IamActor): Promise<MemberPaymentDetailDto> {
    const existing = await this.mustFind(id);
    if (existing.status === 'REFUNDED' || existing.status === 'PARTIALLY_REFUNDED') {
      throw new ConflictError(ErrorCode.CONFLICT, 'A refunded payment cannot be edited.');
    }

    const amount = input.amount ?? Number(existing.amount);
    const discount = input.discount ?? Number(existing.discount);
    const tax = input.tax ?? Number(existing.tax);
    const finalAmount = Math.max(amount - discount + tax, 0);
    const wasSuccess = existing.status === 'SUCCESS';

    await this.payments.update(id, {
      membershipId: input.membershipId,
      branchId: input.branchId,
      amount: input.amount,
      discount: input.discount,
      tax: input.tax,
      finalAmount,
      method: input.method,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : undefined,
      transactionReference: input.transactionReference,
      status: input.status,
      notes: input.notes,
    });
    await this.audit(actor, 'member_payment.updated', id);

    const updated = await this.mustFind(id);
    if (!wasSuccess && updated.status === 'SUCCESS') {
      const member = await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: updated.member.id } });
      await this.onPaymentSucceeded(updated, member!, updated.branch.id);
    }
    return toDetailDto((await this.payments.findById(this.tenantId, id))!);
  }

  async cancel(id: string, actor: IamActor): Promise<void> {
    const payment = await this.mustFind(id);
    if (payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') {
      throw new ConflictError(ErrorCode.CONFLICT, 'A refunded payment cannot be cancelled.');
    }
    if (payment.status === 'CANCELLED') throw new ConflictError(ErrorCode.CONFLICT, 'This payment is already cancelled.');
    await this.payments.update(id, { status: 'CANCELLED' });
    await this.audit(actor, 'member_payment.cancelled', id);
  }

  /**
   * "Verify Payment Status" — for CASH/UPI/etc this is just an authoritative
   * read of the stored status (there's nothing to poll); ONLINE_GATEWAY is
   * listed as a future integration, so this is also the seam a real gateway
   * webhook/poll would eventually update through instead of just reading.
   */
  async verifyStatus(id: string): Promise<{ status: MemberPaymentDetailRow['status']; verifiedAt: string }> {
    const payment = await this.mustFind(id);
    return { status: payment.status, verifiedAt: new Date().toISOString() };
  }

  /** "Refunds must create financial history" — always a NEW row, the original payment is never mutated beyond its status flag. */
  async refund(id: string, input: RefundPaymentInput, actor: IamActor): Promise<MemberPaymentDetailDto> {
    const payment = await this.mustFind(id);
    if (payment.status !== 'SUCCESS' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new ConflictError(ErrorCode.CONFLICT, 'Only a successful payment can be refunded.');
    }

    const alreadyRefunded = await this.payments.sumRefunded(this.tenantId, id);
    const finalAmount = Number(payment.finalAmount);
    const remaining = finalAmount - alreadyRefunded;
    const refundAmount = input.amount ?? remaining;
    if (refundAmount <= 0 || refundAmount > remaining + 0.001) {
      throw new ValidationError(`Refund amount must be between 0 and the remaining refundable balance ($${remaining.toFixed(2)}).`);
    }

    await this.payments.createRefund({
      tenantId: this.tenantId,
      paymentId: id,
      amount: refundAmount,
      reason: input.reason,
      refundedBy: actor.userId,
    });

    const newTotal = alreadyRefunded + refundAmount;
    const isFullyRefunded = newTotal >= finalAmount - 0.001;
    await this.payments.update(id, { status: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' });
    await this.audit(actor, 'member_payment.refunded', id);

    return toDetailDto((await this.payments.findById(this.tenantId, id))!);
  }

  async exportCsv(query: Partial<ListPaymentsQuery>): Promise<string> {
    const { items: rawItems } = await this.payments.list(this.tenantId, { page: 1, limit: 10_000, sortBy: 'paymentDate', sortDir: 'desc', ...query });
    const items = rawItems.map(toListDto);
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const header = 'Payment Number,Member,Amount,Discount,Tax,Final Amount,Method,Payment Date,Status,Transaction Reference';
    const rows = items.map((row) =>
      [
        row.paymentNumber,
        row.member.name,
        row.amount,
        row.discount,
        row.tax,
        row.finalAmount,
        row.method,
        row.paymentDate,
        row.status,
        row.transactionReference ?? '',
      ]
        .map((v) => escape(String(v)))
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  async exportExcel(query: Partial<ListPaymentsQuery>): Promise<ExcelJS.Buffer> {
    const { items: rawItems } = await this.payments.list(this.tenantId, { page: 1, limit: 10_000, sortBy: 'paymentDate', sortDir: 'desc', ...query });
    const items = rawItems.map(toListDto);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Payments');
    sheet.columns = [
      { header: 'Payment Number', key: 'paymentNumber', width: 16 },
      { header: 'Member', key: 'member', width: 24 },
      { header: 'Final Amount', key: 'finalAmount', width: 14 },
      { header: 'Method', key: 'method', width: 16 },
      { header: 'Payment Date', key: 'paymentDate', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Reference', key: 'reference', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const row of items) {
      sheet.addRow({
        paymentNumber: row.paymentNumber,
        member: row.member.name,
        finalAmount: Number(row.finalAmount),
        method: row.method,
        paymentDate: row.paymentDate,
        status: row.status,
        reference: row.transactionReference ?? '',
      });
    }
    return workbook.xlsx.writeBuffer();
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string): Promise<MemberPaymentDetailRow> {
    const payment = await this.payments.findById(this.tenantId, id);
    if (!payment) throw new NotFoundError('Payment not found.');
    return payment;
  }

  /**
   * Business rules: "every successful membership payment automatically
   * generates an invoice" (only when no invoice was already attached at
   * creation — an invoice-settling payment already has one) + auto-records
   * a `MEMBERSHIP_FEE` income row so the revenue ledger stays in sync with
   * cash actually received.
   */
  private async onPaymentSucceeded(
    payment: MemberPaymentDetailRow,
    member: { firstName: string; lastName: string; email: string | null },
    branchId: string,
  ): Promise<void> {
    if (!payment.invoiceId) {
      const invoice = await this.invoiceService.generateForPayment({
        memberId: payment.member.id,
        branchId,
        amount: Number(payment.finalAmount),
        description: payment.membership ? `Membership payment — ${payment.membership.plan.name}` : 'Membership payment',
        paymentDate: payment.paymentDate,
      });
      await this.payments.update(payment.id, { invoiceId: invoice.id });
    } else {
      await this.invoiceService.markStatus(payment.invoiceId, 'PAID');
    }

    const existingIncome = await this.db.income.findFirst({ where: { tenantId: this.tenantId, sourcePaymentId: payment.id } });
    if (!existingIncome) {
      await this.db.income.create({
        data: {
          tenantId: this.tenantId,
          category: 'MEMBERSHIP_FEE',
          amount: payment.finalAmount,
          incomeDate: payment.paymentDate,
          branchId,
          description: `Payment ${payment.paymentNumber} — ${member.firstName} ${member.lastName}`.trim(),
          sourcePaymentId: payment.id,
        },
      });
    }

    await notifyPaymentReceived(this.tenantId, {
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      amount: Number(payment.finalAmount).toFixed(2),
      paymentNumber: payment.paymentNumber,
      memberEmail: member.email,
    });
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'member_payment',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
