import { NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import { formatMoney } from '../../../infrastructure/mail/templates/base-layout';
import { memberInvoiceSummaryEmail } from '../../../infrastructure/mail/templates/member-templates';
import { assertBranchAccess, getBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { decryptMemberContactNullable } from '../../members/utils/member-pii.util';
import { TenantInvoiceSettingsRepository } from '../../settings/repositories/tenant-invoice-settings.repository';
import { CHANNEL_GATE_DENIAL_MESSAGE, sendGatedEmail } from '../../tenant-notifications/services/channel-gate.service';
import { tenantService } from '../../tenants/service/tenant.service';
import type { GenerateInvoiceInput, InvoiceAnalyticsDto, InvoiceAnalyticsQuery, InvoiceItemDto, InvoiceItemInput, ListInvoicesQuery, MemberInvoiceDetailDto, MemberInvoiceListItemDto } from '../dto/finance.dto';
import { MemberInvoiceRepository, type MemberInvoiceDetailRow, type MemberInvoiceListRow } from '../repositories/member-invoice.repository';
import { assembleInvoiceAnalytics } from '../utils/invoice-analytics.util';
import { loadInvoiceLogo } from '../utils/invoice-logo.util';
import { renderInvoicePdf } from '../utils/invoice-pdf.renderer';
import { resolveRanges } from '../utils/payments-analytics.util';

function toListDto(row: MemberInvoiceListRow): MemberInvoiceListItemDto {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    member: {
      id: row.member.id,
      memberId: row.member.memberId,
      name: `${row.member.firstName} ${row.member.lastName}`.trim(),
    },
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
    const [{ items, total }, extras] = await Promise.all([
      this.invoices.list(this.tenantId, query, restrictToBranchIds),
      this.invoices.listExtras(this.tenantId, query, restrictToBranchIds),
    ]);
    return {
      items: items.map(toListDto),
      ...extras,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async analytics(query: InvoiceAnalyticsQuery, actorUserId: string): Promise<InvoiceAnalyticsDto> {
    const restrictToBranchIds = await this.resolveBranchRestriction(actorUserId);
    const { range, previousRange, today } = resolveRanges(query.dateFrom, query.dateTo);
    return assembleInvoiceAnalytics(await this.invoices.analyticsRaw(this.tenantId, range, previousRange, today, query.branchId, restrictToBranchIds));
  }

  async getById(id: string, actorUserId: string): Promise<MemberInvoiceDetailDto> {
    return toDetailDto(await this.mustFind(id, actorUserId));
  }

  /** Manual "Generate Invoice" — e.g. billing an upcoming renewal in advance, with no payment yet. */
  async generate(input: GenerateInvoiceInput, actor: IamActor): Promise<MemberInvoiceDetailDto> {
    const member = await this.db.member.findFirst({
      where: { tenantId: this.tenantId, id: input.memberId, deletedAt: null },
    });
    if (!member) throw new NotFoundError('Member not found.');
    const branchId = input.branchId ?? member.branchId;
    await assertBranchAccess(this.tenantId, actor.userId, branchId);

    const invoice = await this.createInvoiceRow({
      memberId: input.memberId,
      branchId,
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      items: input.items,
      taxAmount: input.taxAmount ?? 0,
      discountAmount: input.discountAmount ?? 0,
      notes: input.notes,
      status: 'UNPAID',
    });
    await this.audit(actor, 'member_invoice.generated', invoice.id);
    return toDetailDto(invoice);
  }

  /**
   * Auto-invoice on a successful payment (business rule) — called by
   * `MemberPaymentService`, never exposed directly as a route. One line
   * item per `input.items` entry (e.g. plan price, plan registration fee,
   * member registration fee, kept separate so the invoice itemizes exactly
   * what was charged) plus the payment's own `taxAmount`/`discountAmount` —
   * both now threaded through from `MemberPaymentService#onPaymentSucceeded`
   * instead of being hardcoded to 0, so `subtotal - discountAmount +
   * taxAmount` always reconciles to the actual `Payment.finalAmount` by
   * construction. `status` is `PAID` since the settling payment already
   * exists.
   */
  async generateForPayment(input: {
    memberId: string;
    branchId: string;
    items: InvoiceItemInput[];
    taxAmount: number;
    discountAmount: number;
    paymentDate: Date;
  }): Promise<MemberInvoiceDetailRow> {
    return this.createInvoiceRow({
      memberId: input.memberId,
      branchId: input.branchId,
      invoiceDate: input.paymentDate,
      dueDate: input.paymentDate,
      items: input.items,
      taxAmount: input.taxAmount,
      discountAmount: input.discountAmount,
      status: 'PAID',
    });
  }

  /** The auto-managed unpaid remainder of a membership's price — called only by `MemberBalanceService`. */
  async createBalanceInvoice(input: { memberId: string; branchId: string; membershipId: string; planName: string; amount: number }): Promise<MemberInvoiceDetailRow> {
    return this.createInvoiceRow({
      memberId: input.memberId,
      branchId: input.branchId,
      membershipId: input.membershipId,
      invoiceDate: new Date(),
      items: [{ description: `Balance due — ${input.planName}`, quantity: 1, unitPrice: input.amount }],
      taxAmount: 0,
      discountAmount: 0,
      status: 'UNPAID',
    });
  }

  async settleBalanceWithReceipt(id: string, input: { items: InvoiceItemInput[]; taxAmount: number; discountAmount: number }): Promise<void> {
    await this.invoices.settleWithReceipt(this.tenantId, id, input.items, input.taxAmount, input.discountAmount);
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
    return {
      items: items.map(toListDto),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  /** `memberId` is the AUTHENTICATED member (never a URL value) — the row is only found if it is theirs, else 404. */
  async getOwnById(id: string, memberId: string): Promise<MemberInvoiceDetailDto> {
    const invoice = await this.invoices.findOwnById(this.tenantId, memberId, id);
    if (!invoice) throw new NotFoundError('Invoice not found.');
    return toDetailDto(invoice);
  }

  /** Same ownership scoping as `getOwnById` — the service itself refuses a foreign invoice, not just its caller. */
  async renderOwnPdf(id: string, memberId: string, tenantName: string): Promise<Buffer> {
    const invoice = await this.invoices.findOwnById(this.tenantId, memberId, id);
    if (!invoice) throw new NotFoundError('Invoice not found.');
    return this.renderPdfFor(toDetailDto(invoice), tenantName);
  }

  private async renderPdfFor(invoice: MemberInvoiceDetailDto, tenantName: string): Promise<Buffer> {
    const [settings, profile, invoiceSettings, tenant] = await Promise.all([
      this.db.tenantSettings.findUnique({ where: { tenantId: this.tenantId } }),
      this.db.tenantProfile.findUnique({ where: { tenantId: this.tenantId } }),
      this.invoiceSettings.find(this.tenantId),
      tenantService.resolveById(this.tenantId),
    ]);
    const logo = await loadInvoiceLogo(tenant?.branding.logoUrl);
    return renderInvoicePdf({
      invoice,
      tenantName,
      profile,
      logo,
      footerText: invoiceSettings?.invoiceFooter ?? null,
      currencySymbol: settings?.currencySymbol ?? '₹',
    });
  }

  /** "Email Invoice" — reuses the existing `enqueueEmail` queue; no attachment support exists in the mail infra, so this sends a summary with the key details rather than the PDF itself. */
  async email(id: string, actor: IamActor, overrideEmail?: string): Promise<void> {
    const invoice = toDetailDto(await this.mustFind(id, actor.userId));
    const member = decryptMemberContactNullable(await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: invoice.member.id } }));
    const to = overrideEmail ?? member?.email;
    if (!to) throw new ValidationError('This member has no email on file — provide one explicitly.');

    const branding = await loadEmailBranding(this.tenantId);
    const settings = await this.db.tenantSettings.findUnique({
      where: { tenantId: this.tenantId },
    });
    const currencySymbol = settings?.currencySymbol ?? '₹';
    const mail = memberInvoiceSummaryEmail(
      branding,
      invoice.member.name,
      invoice.invoiceNumber,
      invoice.invoiceDate,
      formatMoney(Number(invoice.totalAmount), currencySymbol),
      invoice.status === 'CANCELLED' ? 'UNPAID' : invoice.status,
      invoice.dueDate,
      invoice.items[0]?.description ?? null,
      { lineItems: invoice.items.map((item) => ({ description: item.description, quantity: item.quantity, amount: formatMoney(Number(item.amount), currencySymbol) })) },
    );
    const gate = await sendGatedEmail(this.tenantId, { to, subject: mail.subject, html: mail.html });
    if (!gate.allowed) throw new ValidationError(CHANNEL_GATE_DENIAL_MESSAGE[gate.reason!]);
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
    membershipId?: string;
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
        membershipId: input.membershipId,
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
