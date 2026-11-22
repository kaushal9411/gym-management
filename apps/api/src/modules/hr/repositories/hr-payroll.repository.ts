import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export type RunRow = Prisma.HrPayrollRunGetPayload<Record<string, never>>;
export type PayslipRow = Prisma.HrPayslipGetPayload<Record<string, never>>;

export class HrPayrollRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  // ── runs ────────────────────────────────────────────────────────────────
  findRun(tenantId: string, id: string): Promise<RunRow | null> {
    return this.db.hrPayrollRun.findFirst({ where: { tenantId, id } });
  }

  findRunByMonth(tenantId: string, month: string): Promise<RunRow | null> {
    return this.db.hrPayrollRun.findFirst({ where: { tenantId, month } });
  }

  async listRuns(tenantId: string, skip: number, take: number): Promise<{ items: RunRow[]; total: number }> {
    const [items, total] = await Promise.all([
      this.db.hrPayrollRun.findMany({ where: { tenantId }, orderBy: { month: 'desc' }, skip, take }),
      this.db.hrPayrollRun.count({ where: { tenantId } }),
    ]);
    return { items, total };
  }

  createRun(data: Prisma.HrPayrollRunUncheckedCreateInput): Promise<RunRow> {
    return this.db.hrPayrollRun.create({ data });
  }

  updateRun(id: string, data: Prisma.HrPayrollRunUncheckedUpdateInput): Promise<RunRow> {
    return this.db.hrPayrollRun.update({ where: { id }, data });
  }

  /** Atomic DRAFT -> APPROVED. */
  async approveRun(tenantId: string, id: string, approvedBy: string): Promise<boolean> {
    const r = await this.db.hrPayrollRun.updateMany({ where: { tenantId, id, status: 'DRAFT' }, data: { status: 'APPROVED', approvedBy, approvedAt: new Date() } });
    return r.count === 1;
  }

  async deleteRun(id: string): Promise<void> {
    await this.db.hrPayrollRun.delete({ where: { id } });
  }

  /** runId -> {paidCount, paidAmount} */
  async paidByRun(tenantId: string, runIds: string[]): Promise<Map<string, { paidCount: number; paidAmount: number }>> {
    if (runIds.length === 0) return new Map();
    const rows = await this.db.hrPayslip.groupBy({ by: ['runId'], where: { tenantId, runId: { in: runIds }, status: 'PAID' }, _count: { _all: true }, _sum: { netPay: true } });
    return new Map(rows.map((r) => [r.runId, { paidCount: r._count._all, paidAmount: Number(r._sum.netPay ?? 0) }]));
  }

  // ── payslips ────────────────────────────────────────────────────────────
  listByRun(tenantId: string, runId: string): Promise<PayslipRow[]> {
    return this.db.hrPayslip.findMany({ where: { tenantId, runId }, orderBy: { employeeCode: 'asc' } });
  }

  findPayslip(tenantId: string, id: string): Promise<PayslipRow | null> {
    return this.db.hrPayslip.findFirst({ where: { tenantId, id } });
  }

  async createPayslip(data: Prisma.HrPayslipUncheckedCreateInput): Promise<PayslipRow> {
    return this.db.hrPayslip.create({ data });
  }

  updatePayslip(id: string, data: Prisma.HrPayslipUncheckedUpdateInput): Promise<PayslipRow> {
    return this.db.hrPayslip.update({ where: { id }, data });
  }

  /** The atomic claim that makes double payment impossible: only one caller can flip DRAFT -> PAID. */
  async claimPaid(tenantId: string, id: string, data: { paidAt: Date; paidOn: Date; paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'; paidBy: string; paidRemark: string | null }): Promise<boolean> {
    const r = await this.db.hrPayslip.updateMany({ where: { tenantId, id, status: 'DRAFT' }, data: { status: 'PAID', ...data } });
    return r.count === 1;
  }

  async releaseClaim(id: string): Promise<void> {
    await this.db.hrPayslip.update({ where: { id }, data: { status: 'DRAFT', paidAt: null, paidOn: null, paymentMode: null, paidBy: null, paidRemark: null, expenseId: null } });
  }

  countUnpaid(tenantId: string, runId: string): Promise<number> {
    return this.db.hrPayslip.count({ where: { tenantId, runId, status: 'DRAFT' } });
  }

  async listForUser(tenantId: string, userId: string, opts: { visibleOnly: boolean; skip: number; take: number }): Promise<{ items: PayslipRow[]; total: number }> {
    const where: Prisma.HrPayslipWhereInput = { tenantId, userId, ...(opts.visibleOnly ? { run: { status: { in: ['APPROVED', 'PAID'] } } } : {}) };
    const [items, total] = await Promise.all([
      this.db.hrPayslip.findMany({ where, orderBy: { month: 'desc' }, skip: opts.skip, take: opts.take }),
      this.db.hrPayslip.count({ where }),
    ]);
    return { items, total };
  }

  /** A payslip together with its run status, for the employee-visibility rule. */
  findWithRun(tenantId: string, id: string) {
    return this.db.hrPayslip.findFirst({ where: { tenantId, id }, include: { run: { select: { status: true } } } });
  }
}
