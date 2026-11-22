import { businessDate } from '../../../core/utils/business-time';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { FinanceDashboardDto } from '../dto/finance.dto';
import { ExpenseRepository } from '../repositories/expense.repository';
import { IncomeRepository } from '../repositories/income.repository';
import { MemberPaymentRepository, type MemberPaymentListRow } from '../repositories/member-payment.repository';

function toListItem(row: MemberPaymentListRow, totalRefunded = 0) {
  return {
    id: row.id,
    paymentNumber: row.paymentNumber,
    member: {
      id: row.member.id,
      memberId: row.member.memberId,
      name: `${row.member.firstName} ${row.member.lastName}`.trim(),
    },
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
    totalRefunded: totalRefunded.toFixed(2),
  };
}

/** Add `days` (may be negative) to a YYYY-MM-DD string, UTC-safe. */
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parts of the finance summary that belong to a module of their own (the route itself is gated on `payments`). */
const FINANCE_MODULES = ['income', 'expenses', 'payments'] as const;

export class FinanceDashboardService {
  private readonly db: TenantScopedPrisma;
  private readonly payments: MemberPaymentRepository;
  private readonly income: IncomeRepository;
  private readonly expenses: ExpenseRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.payments = new MemberPaymentRepository(this.db);
    this.income = new IncomeRepository(this.db);
    this.expenses = new ExpenseRepository(this.db);
  }

  /** `enabledModules` = tenant `featureFlags`; omitted = everything on. Disabled parts are not queried and come back zeroed. */
  async getSummary(branchId?: string, enabledModules?: readonly string[]): Promise<FinanceDashboardDto> {
    const on = (key: string): boolean => !enabledModules || enabledModules.includes(key);
    const disabledModules = FINANCE_MODULES.filter((k) => !on(k));
    const todayStr = businessDate();
    const today = new Date(`${todayStr}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);
    const monthStartStr = `${todayStr.slice(0, 7)}-01`;
    const monthStart = new Date(`${monthStartStr}T00:00:00.000Z`);

    const [todayIncome, monthlyIncome, monthlyExpenses, outstanding, recentPayments, trendFrom] = await Promise.all([
      on('income') ? this.income.sumForDateRange(this.tenantId, today, todayEnd, branchId) : Promise.resolve(0),
      on('income') ? this.income.sumForDateRange(this.tenantId, monthStart, todayEnd, branchId) : Promise.resolve(0),
      on('expenses') ? this.expenses.sumForDateRange(this.tenantId, monthStart, todayEnd, branchId) : Promise.resolve(0),
      on('payments') ? this.payments.sumOutstanding(this.tenantId, branchId) : Promise.resolve({ total: 0, count: 0 }),
      on('payments') ? this.payments.recent(this.tenantId, 10, branchId) : Promise.resolve([]),
      Promise.resolve(addDaysStr(todayStr, -29)),
    ]);

    const refunded = await this.payments.refundTotalsByPayment(
      this.tenantId,
      recentPayments.map((p) => p.id),
    );
    const trendFromDate = new Date(`${trendFrom}T00:00:00.000Z`);
    const [incomeDaily, expenseDaily] = await Promise.all([
      on('income') ? this.income.dailyTotalsForRange(this.tenantId, trendFromDate, todayEnd, branchId) : Promise.resolve([]),
      on('expenses') ? this.expenses.dailyTotalsForRange(this.tenantId, trendFromDate, todayEnd, branchId) : Promise.resolve([]),
    ]);
    const incomeByDate = new Map(incomeDaily.map((d) => [d.date.toISOString().slice(0, 10), d.total]));
    const expenseByDate = new Map(expenseDaily.map((d) => [d.date.toISOString().slice(0, 10), d.total]));

    const revenueTrend: Array<{ date: string; income: number; expenses: number }> = [];
    for (let d = trendFrom; d <= todayStr; d = addDaysStr(d, 1)) {
      revenueTrend.push({
        date: d,
        income: incomeByDate.get(d) ?? 0,
        expenses: expenseByDate.get(d) ?? 0,
      });
    }

    return {
      todayIncome: todayIncome.toFixed(2),
      monthlyIncome: monthlyIncome.toFixed(2),
      monthlyExpenses: monthlyExpenses.toFixed(2),
      outstandingPayments: outstanding.total.toFixed(2),
      outstandingInvoiceCount: outstanding.count,
      recentPayments: recentPayments.map((row) => toListItem(row, refunded.get(row.id) ?? 0)),
      revenueTrend,
      disabledModules,
    };
  }
}
