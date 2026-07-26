import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { FinanceDashboardDto } from '../dto/finance.dto';
import { ExpenseRepository } from '../repositories/expense.repository';
import { IncomeRepository } from '../repositories/income.repository';
import { MemberPaymentRepository, type MemberPaymentListRow } from '../repositories/member-payment.repository';

function toListItem(row: MemberPaymentListRow) {
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

/** Add `days` (may be negative) to a YYYY-MM-DD string, UTC-safe. */
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

  async getSummary(branchId?: string): Promise<FinanceDashboardDto> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(`${todayStr}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);
    const monthStartStr = `${todayStr.slice(0, 7)}-01`;
    const monthStart = new Date(`${monthStartStr}T00:00:00.000Z`);

    const [todayIncome, monthlyIncome, monthlyExpenses, outstanding, recentPayments, trendFrom] = await Promise.all([
      this.income.sumForDateRange(this.tenantId, today, todayEnd, branchId),
      this.income.sumForDateRange(this.tenantId, monthStart, todayEnd, branchId),
      this.expenses.sumForDateRange(this.tenantId, monthStart, todayEnd, branchId),
      this.payments.sumOutstanding(this.tenantId, branchId),
      this.payments.recent(this.tenantId, 10, branchId),
      Promise.resolve(addDaysStr(todayStr, -29)),
    ]);

    const trendFromDate = new Date(`${trendFrom}T00:00:00.000Z`);
    const [incomeDaily, expenseDaily] = await Promise.all([
      this.income.dailyTotalsForRange(this.tenantId, trendFromDate, todayEnd, branchId),
      this.expenses.dailyTotalsForRange(this.tenantId, trendFromDate, todayEnd, branchId),
    ]);
    const incomeByDate = new Map(incomeDaily.map((d) => [d.date.toISOString().slice(0, 10), d.total]));
    const expenseByDate = new Map(expenseDaily.map((d) => [d.date.toISOString().slice(0, 10), d.total]));

    const revenueTrend: Array<{ date: string; income: number; expenses: number }> = [];
    for (let d = trendFrom; d <= todayStr; d = addDaysStr(d, 1)) {
      revenueTrend.push({ date: d, income: incomeByDate.get(d) ?? 0, expenses: expenseByDate.get(d) ?? 0 });
    }

    return {
      todayIncome: todayIncome.toFixed(2),
      monthlyIncome: monthlyIncome.toFixed(2),
      monthlyExpenses: monthlyExpenses.toFixed(2),
      outstandingPayments: outstanding.total.toFixed(2),
      outstandingInvoiceCount: outstanding.count,
      recentPayments: recentPayments.map(toListItem),
      revenueTrend,
    };
  }
}
