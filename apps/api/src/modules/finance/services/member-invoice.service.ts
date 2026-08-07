import PDFDocument from 'pdfkit';

import { NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { assertBranchAccess, getBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { decryptMemberContactNullable } from '../../members/utils/member-pii.util';
import { TenantInvoiceSettingsRepository } from '../../settings/repositories/tenant-invoice-settings.repository';
import type {
  GenerateInvoiceInput,
  InvoiceItemDto,
  InvoiceItemInput,
  ListInvoicesQuery,
  MemberInvoiceDetailDto,
  MemberInvoiceListItemDto,
} from '../dto/finance.dto';
import { MemberInvoiceRepository, type MemberInvoiceDetailRow, type MemberInvoiceListRow } from '../repositories/member-invoice.repository';

function toListDto(row: MemberInvoiceListRow): MemberInvoiceListItemDto {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    member: { id: row.member.id, memberId: row.member.memberId, name: `${row.member.firstName} ${row.member.lastName}`.trim() },
    branch: { id: row.branch.id, name: row.branch.name },
    invoiceDate: row.invoiceDate.toISOString().slice(0, 10),
    dueDate: row.dueDate.toISOString().slice(0, 10),
    subtotal: row.subtotal.toString(),
    taxAmount: row.taxAmount.toString(),
    discountAmount: row.discountAmount.toString(),
    totalAmount: row.totalAmount.toString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function toItemDto(row: MemberInvoiceDetailRow['items'][number]): InvoiceItemDto {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unitPrice.toString(),
    amount: row.amount.toString(),
    sortOrder: row.sortOrder,
  };
}

function toDetailDto(row: MemberInvoiceDetailRow): MemberInvoiceDetailDto {
  return {
    ...toListDto(row),
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map(toItemDto),
    payments: row.payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      finalAmount: p.finalAmount.toString(),
      status: p.status,
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
    })),
  };
}

export class MemberInvoiceService {
  private readonly db: TenantScopedPrisma;
  private readonly invoices: MemberInvoiceRepository;
  private readonly invoiceSettings: TenantInvoiceSettingsRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.invoices = new MemberInvoiceRepository(this.db);
    this.invoiceSettings = new TenantInvoiceSettingsRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(query: ListInvoicesQuery, actorUserId: string) {
    const restrictToBranchIds = await this.resolveBranchRestriction(actorUserId);
    const { items, total } = await this.invoices.list(this.tenantId, query, restrictToBranchIds);
    return { items: items.map(toListDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async getById(id: string, actorUserId: string): Promise<MemberInvoiceDetailDto> {
    return toDetailDto(await this.mustFind(id, actorUserId));
  }

  /** Manual "Generate Invoice" — e.g. billing an upcoming renewal in advance, with no payment yet. */
  async generate(input: GenerateInvoiceInput, actor: IamActor): Promise<MemberInvoiceDetailDto> {
    const member = await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: input.memberId, deletedAt: null } });
    if (!member) throw new NotFoundError('Member not found.');
    const branchId = input.branchId ?? member.branchId;
    await assertBranchAccess(this.tenantId, actor.userId, branchId);

    const invoice = await this.createInvoiceRow(
      {
        memberId: input.memberId,
        branchId,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        items: input.items,
        taxAmount: input.taxAmount ?? 0,
        discountAmount: input.discountAmount ?? 0,
        notes: input.notes,
        status: 'UNPAID',
      },
    );
    await this.audit(actor, 'member_invoice.generated', invoice.id);
    return toDetailDto(invoice);
  }

  /**
   * Auto-invoice on a successful payment (business rule) — called by
   * `MemberPaymentService`, never exposed directly as a route. A single
   * line item summarizing the payment; `status` is `PAID` since the
   * settling payment already exists.
   */
  async generateForPayment(input: {
    memberId: string;
    branchId: string;
    amount: number;
    description: string;
    paymentDate: Date;
  }): Promise<MemberInvoiceDetailRow> {
    return this.createInvoiceRow({
      memberId: input.memberId,
      branchId: input.branchId,
      invoiceDate: input.paymentDate,
      dueDate: input.paymentDate,
      items: [{ description: input.description, quantity: 1, unitPrice: input.amount }],
      taxAmount: 0,
      discountAmount: 0,
      status: 'PAID',
    });
  }

  async markStatus(id: string, status: MemberInvoiceDetailRow['status']): Promise<void> {
    await this.invoices.setStatus(id, status);
  }

  /** "Download Invoice (PDF)" — a real binary PDF via pdfkit (the platform's own invoice module uses HTML-only since no renderer existed at the time; this module explicitly needs PDF per spec). */
  async renderPdf(id: string, tenantName: string, actorUserId: string): Promise<Buffer> {
    return this.renderPdfFor(toDetailDto(await this.mustFind(id, actorUserId)), tenantName);
  }

  // ── Member-portal self-view (Prompt 48) ─────────────────────────────────
  // No branch check on any of these three — a member has an unconditional
  // right to their own invoices, and `MemberPortalService` already scopes
  // every call to `memberId` (an ownership check strictly narrower than
  // "any invoice in a branch this actor can reach"). Mirrors
  // `MemberService#getOwnProfile`'s same rationale/precedent.

  async listOwn(query: ListInvoicesQuery) {
    const { items, total } = await this.invoices.list(this.tenantId, query);
    return { items: items.map(toListDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async getOwnById(id: string): Promise<MemberInvoiceDetailDto> {
    const invoice = await this.invoices.findById(this.tenantId, id);
    if (!invoice) throw new NotFoundError('Invoice not found.');
    return toDetailDto(invoice);
  }

  async renderOwnPdf(id: string, tenantName: string): Promise<Buffer> {
    const invoice = await this.invoices.findById(this.tenantId, id);
    if (!invoice) throw new NotFoundError('Invoice not found.');
    return this.renderPdfFor(toDetailDto(invoice), tenantName);
  }

  private renderPdfFor(invoice: MemberInvoiceDetailDto, tenantName: string): Promise<Buffer> {
    const money = (amount: string | number) => `$${Number(amount).toFixed(2)}`;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text(`Invoice ${invoice.invoiceNumber}`, { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`${tenantName}`);
      doc.text(`Billed to: ${invoice.member.name}`);
      doc.text(`Invoice date: ${invoice.invoiceDate}    Due date: ${invoice.dueDate}`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown();
      doc.fillColor('#111827');

      const tableTop = doc.y;
      doc.fontSize(10).text('Description', 50, tableTop, { width: 260 });
      doc.text('Qty', 320, tableTop, { width: 50, align: 'right' });
      doc.text('Unit price', 370, tableTop, { width: 80, align: 'right' });
      doc.text('Amount', 460, tableTop, { width: 80, align: 'right' });
      doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).stroke();

      let y = tableTop + 22;
      for (const item of invoice.items) {
        doc.text(item.description, 50, y, { width: 260 });
        doc.text(String(item.quantity), 320, y, { width: 50, align: 'right' });
        doc.text(money(item.unitPrice), 370, y, { width: 80, align: 'right' });
        doc.text(money(item.amount), 460, y, { width: 80, align: 'right' });
        y += 20;
      }

      y += 10;
      doc.text(`Subtotal: ${money(invoice.subtotal)}`, 370, y, { width: 170, align: 'right' });
      y += 16;
      doc.text(`Tax: ${money(invoice.taxAmount)}`, 370, y, { width: 170, align: 'right' });
      y += 16;
      doc.text(`Discount: -${money(invoice.discountAmount)}`, 370, y, { width: 170, align: 'right' });
      y += 16;
      doc.fontSize(12).text(`Total: ${money(invoice.totalAmount)}`, 370, y, { width: 170, align: 'right' });

      if (invoice.notes) {
        doc.moveDown(2).fontSize(9).fillColor('#6b7280').text(invoice.notes);
      }

      doc.end();
    });
  }

  /** "Email Invoice" — reuses the existing `enqueueEmail` queue; no attachment support exists in the mail infra, so this sends a summary with the key details rather than the PDF itself. */
  async email(id: string, actor: IamActor, overrideEmail?: string): Promise<void> {
    const invoice = toDetailDto(await this.mustFind(id, actor.userId));
    const member = decryptMemberContactNullable(await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: invoice.member.id } }));
    const to = overrideEmail ?? member?.email;
    if (!to) throw new ValidationError('This member has no email on file — provide one explicitly.');

    await enqueueEmail({
      to,
      subject: `Invoice ${invoice.invoiceNumber}`,
      html: `<p>Hi ${invoice.member.name},</p><p>Your invoice <strong>${invoice.invoiceNumber}</strong> dated ${invoice.invoiceDate} for <strong>$${invoice.totalAmount}</strong> is ${invoice.status === 'PAID' ? 'paid — thank you!' : `due by ${invoice.dueDate}.`}</p><p>Sign in to your gym's member portal to view the full details.</p>`,
    });
    await this.audit(actor, 'member_invoice.emailed', id);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string, actorUserId: string): Promise<MemberInvoiceDetailRow> {
    const invoice = await this.invoices.findById(this.tenantId, id);
    if (!invoice) throw new NotFoundError('Invoice not found.');
    await assertBranchAccess(this.tenantId, actorUserId, invoice.branch.id);
    return invoice;
  }

  private async resolveBranchRestriction(actorUserId: string): Promise<string[] | undefined> {
    const access = await getBranchAccess(this.tenantId, actorUserId);
    return access.allBranches ? undefined : access.branchIds;
  }

  private async createInvoiceRow(input: {
    memberId: string;
    branchId: string;
    invoiceDate: Date;
    dueDate?: Date;
    items: InvoiceItemInput[];
    taxAmount: number;
    discountAmount: number;
    notes?: string;
    status?: 'UNPAID' | 'PAID';
  }): Promise<MemberInvoiceDetailRow> {
    const settings = await this.invoiceSettings.find(this.tenantId);
    const prefix = settings?.invoicePrefix ?? 'INV';
    const termsDays = settings?.defaultPaymentTermsDays ?? 15;
    const invoiceNumber = await this.invoices.nextInvoiceNumber(this.tenantId, prefix);

    const subtotal = input.items.reduce((sum, item) => sum + (item.quantity ?? 1) * item.unitPrice, 0);
    const totalAmount = Math.max(subtotal - input.discountAmount + input.taxAmount, 0);
    const dueDate = input.dueDate ?? new Date(input.invoiceDate.getTime() + termsDays * 24 * 60 * 60 * 1000);

    return this.invoices.create(
      {
        tenantId: this.tenantId,
        invoiceNumber,
        memberId: input.memberId,
        branchId: input.branchId,
        invoiceDate: input.invoiceDate,
        dueDate,
        subtotal,
        taxAmount: input.taxAmount,
        discountAmount: input.discountAmount,
        totalAmount,
        status: input.status ?? 'UNPAID',
        notes: input.notes,
      },
      input.items,
    );
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'member_invoice',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
