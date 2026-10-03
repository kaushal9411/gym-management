import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { MemberInvoiceRepository } from '../repositories/member-invoice.repository';

import { MemberInvoiceService } from './member-invoice.service';

const OPEN_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as const;

/**
 * Keeps one auto-managed "Balance due" invoice per ACTIVE/PENDING membership
 * equal to `priceAtAssignment - SUCCESS payments`. A payment only ever
 * invoices the amount actually received (a PAID receipt), so without this
 * the unpaid remainder of a part-paid (or unpaid) plan lived on no invoice
 * at all and every invoice-based figure — dashboard Outstanding tile,
 * invoice list, finance totals, the member portal's "Pay now" — read 0.
 */
export class MemberBalanceService {
  private readonly db: TenantScopedPrisma;
  private readonly invoices: MemberInvoiceRepository;
  private readonly invoiceService: MemberInvoiceService;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.invoices = new MemberInvoiceRepository(this.db);
    this.invoiceService = new MemberInvoiceService(tenantId);
  }

  /** The open balance invoice for a membership, if any. */
  async findOpenBalanceInvoice(membershipId: string): Promise<{ id: string; totalAmount: { toString(): string } } | null> {
    return this.db.memberInvoice.findFirst({
      where: { tenantId: this.tenantId, membershipId, status: { in: [...OPEN_STATUSES] } },
      select: { id: true, totalAmount: true },
    });
  }

  /** Brings every membership of one member in line: create/resize/settle balance invoices, void them for memberships that are no longer live. */
  async reconcileForMember(memberId: string): Promise<void> {
    const memberships = await this.db.membership.findMany({
      where: { tenantId: this.tenantId, memberId },
      include: { plan: { select: { name: true, discountPercentage: true, taxPercentage: true } }, member: { select: { branchId: true } } },
    });
    for (const m of memberships) await this.apply(m);
  }

  async reconcile(membershipId: string): Promise<void> {
    const m = await this.db.membership.findFirst({
      where: { tenantId: this.tenantId, id: membershipId },
      include: { plan: { select: { name: true, discountPercentage: true, taxPercentage: true } }, member: { select: { branchId: true } } },
    });
    if (m) await this.apply(m);
  }

  /** CANCELLED/SUPERSEDED memberships drop their open balance; EXPIRED ones keep it — the member still owes it. */
  private async apply(m: { id: string; memberId: string; status: string; priceAtAssignment: { toString(): string }; plan: { name: string; discountPercentage: { toString(): string }; taxPercentage: { toString(): string } }; member: { branchId: string } }): Promise<void> {
    if (m.status === 'CANCELLED' || m.status === 'SUPERSEDED') await this.voidOpenBalance(m.id);
    else await this.reconcileOne(m);
  }

  private async reconcileOne(m: {
    id: string;
    memberId: string;
    priceAtAssignment: { toString(): string };
    plan: { name: string; discountPercentage: { toString(): string }; taxPercentage: { toString(): string } };
    member: { branchId: string };
  }): Promise<void> {
    const paid = await this.db.memberPayment.aggregate({
      where: { tenantId: this.tenantId, membershipId: m.id, status: 'SUCCESS' },
      _sum: { finalAmount: true },
    });
    // Same discount-then-tax formula as the web/mobile plan price (`computePlanPrice`); fees are not part of the plan's own price.
    const base = Number(m.priceAtAssignment);
    const expected = (base - (base * Number(m.plan.discountPercentage)) / 100) * (1 + Number(m.plan.taxPercentage) / 100);
    const remaining = Math.round((expected - Number(paid._sum.finalAmount ?? 0)) * 100) / 100;
    const open = await this.findOpenBalanceInvoice(m.id);

    if (remaining <= 0) {
      if (open) await this.invoices.setStatus(open.id, 'PAID');
      return;
    }
    if (open) {
      if (Number(open.totalAmount) !== remaining) await this.invoices.resizeBalance(this.tenantId, open.id, remaining);
      return;
    }
    await this.invoiceService.createBalanceInvoice({
      memberId: m.memberId,
      branchId: m.member.branchId,
      membershipId: m.id,
      planName: m.plan.name,
      amount: remaining,
    });
  }

  private async voidOpenBalance(membershipId: string): Promise<void> {
    const open = await this.findOpenBalanceInvoice(membershipId);
    if (open) await this.invoices.setStatus(open.id, 'CANCELLED');
  }
}
