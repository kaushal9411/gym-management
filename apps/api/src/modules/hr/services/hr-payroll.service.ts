import { randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { businessDate } from '../../../core/utils/business-time';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import type { IamActor } from '../../authentication/utils/actor.util';
import { ExpenseService } from '../../finance/services/expense.service';
import type { PayslipDto, PayslipLineDto, PayslipSummaryDto, PayrollRunDto, Paginated } from '../dto/hr.dto';
import { HrAttendanceRepository } from '../repositories/hr-attendance.repository';
import { HrEmployeeRepository, type EmployeeRow } from '../repositories/hr-employee.repository';
import { HrPayrollRepository, type PayslipRow, type RunRow } from '../repositories/hr-payroll.repository';
import { currentMonth, fromDateCol, monthEnd, monthLabel, monthStart, round2, toDateCol } from '../utils/hr-dates.util';
import { computePayslip, totalsFrom, type PayrollAttendanceRow, type PayrollFigures, type PayrollSalaryType } from '../utils/payroll.util';

import { HrAccess } from './hr-access.service';
import { HrAudit } from './hr-audit.service';
import { HrCalendarService, type EmployeeCtx } from './hr-calendar.service';
import { HrConfigService } from './hr-config.service';
import { HrNotificationService } from './hr-notification.service';

type PayMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

interface ManualInputs {
  bonus: number;
  advanceRecovery: number;
  manualLines: PayslipLineDto[];
}

const linesOf = (row: Pick<PayslipRow, 'lines'>): PayslipLineDto[] => (Array.isArray(row.lines) ? (row.lines as unknown as PayslipLineDto[]) : []);
const notesOf = (row: Pick<PayslipRow, 'notes'>): string[] => (Array.isArray(row.notes) ? (row.notes as unknown as string[]) : []);

/** An employee is payable only when a salary amount (> 0) is set; otherwise no payslip is generated. */
export const hasPay = (e: Pick<EmployeeRow, 'staffProfile'>): boolean => Number(e.staffProfile.salaryAmount ?? 0) > 0;

export function splitByPay<T extends Pick<EmployeeRow, 'staffProfile'>>(employees: T[]): { payable: T[]; skippedNoPay: T[] } {
  return { payable: employees.filter(hasPay), skippedNoPay: employees.filter((e) => !hasPay(e)) };
}

export class HrPayrollService {
  readonly repo: HrPayrollRepository;
  private readonly db: ReturnType<typeof getTenantScopedClient>;
  private readonly config: HrConfigService;
  private readonly calendar: HrCalendarService;
  private readonly attendanceRepo: HrAttendanceRepository;
  private readonly employees: HrEmployeeRepository;
  private readonly access: HrAccess;
  private readonly notifications: HrNotificationService;
  private readonly audit: HrAudit;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.repo = new HrPayrollRepository(this.db);
    this.config = new HrConfigService(tenantId);
    this.calendar = new HrCalendarService(tenantId, this.config);
    this.attendanceRepo = new HrAttendanceRepository(this.db);
    this.employees = new HrEmployeeRepository(this.db);
    this.access = new HrAccess(tenantId, this.employees);
    this.notifications = new HrNotificationService(tenantId);
    this.audit = new HrAudit(tenantId, this.db);
  }

  // ── DTOs ────────────────────────────────────────────────────────────────
  async runDtos(rows: RunRow[]): Promise<PayrollRunDto[]> {
    const [paid, names] = await Promise.all([
      this.repo.paidByRun(this.tenantId, rows.map((r) => r.id)),
      this.employees.namesFor(this.tenantId, rows.flatMap((r) => [r.createdBy, r.approvedBy])),
    ]);
    return rows.map((r) => ({
      id: r.id,
      month: r.month,
      status: r.status,
      employeeCount: r.employeeCount,
      totalGross: Number(r.totalGross),
      totalDeductions: Number(r.totalDeductions),
      totalNet: Number(r.totalNet),
      paidCount: paid.get(r.id)?.paidCount ?? 0,
      paidAmount: paid.get(r.id)?.paidAmount ?? 0,
      notes: r.notes,
      createdBy: r.createdBy ? { id: r.createdBy, name: names.get(r.createdBy) ?? 'Unknown' } : null,
      createdAt: r.createdAt.toISOString(),
      approvedBy: r.approvedBy ? { id: r.approvedBy, name: names.get(r.approvedBy) ?? 'Unknown' } : null,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      paidAt: r.paidAt?.toISOString() ?? null,
    }));
  }

  summaryOf(p: PayslipRow, ref: PayslipSummaryDto['employee']): PayslipSummaryDto {
    return {
      id: p.id,
      runId: p.runId,
      month: p.month,
      status: p.status,
      employee: ref,
      grossEarnings: Number(p.grossEarnings),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
      paidAt: p.paidAt?.toISOString() ?? null,
      paymentMode: p.paymentMode,
    };
  }

  async payslipDtos(rows: PayslipRow[]): Promise<PayslipDto[]> {
    const [refs, names] = await Promise.all([
      this.employees.refsFor(this.tenantId, rows.map((r) => r.userId)),
      this.employees.namesFor(this.tenantId, rows.map((r) => r.paidBy)),
    ]);
    return rows.map((p) => ({
      ...this.summaryOf(p, refs.get(p.userId) ?? { userId: p.userId, employeeId: p.employeeCode, name: p.employeeName, avatarUrl: null, role: p.roleName }),
      salaryType: p.salaryType,
      workingDays: p.workingDays,
      presentDays: Number(p.presentDays),
      halfDays: Number(p.halfDays),
      paidLeaveDays: Number(p.paidLeaveDays),
      unpaidLeaveDays: Number(p.unpaidLeaveDays),
      absentDays: Number(p.absentDays),
      holidayDays: p.holidayDays,
      weeklyOffDays: p.weeklyOffDays,
      notEmployedDays: p.notEmployedDays,
      lateCount: p.lateCount,
      overtimeMinutes: p.overtimeMinutes,
      unpaidDays: Number(p.unpaidDays),
      dailyRate: Number(p.dailyRate),
      baseSalary: Number(p.baseSalary),
      fixedAllowances: Number(p.fixedAllowances),
      monthlyGross: Number(p.monthlyGross),
      attendanceDeduction: Number(p.attendanceDeduction),
      overtimePay: Number(p.overtimePay),
      extraAllowances: Number(p.extraAllowances),
      bonus: Number(p.bonus),
      fixedDeductions: Number(p.fixedDeductions),
      extraDeductions: Number(p.extraDeductions),
      latePenalty: Number(p.latePenalty),
      advanceRecovery: Number(p.advanceRecovery),
      lines: linesOf(p),
      notes: notesOf(p),
      paidOn: p.paidOn ? fromDateCol(p.paidOn) : null,
      paidBy: p.paidBy ? { id: p.paidBy, name: names.get(p.paidBy) ?? 'Unknown' } : null,
      paidRemark: p.paidRemark,
      expenseId: p.expenseId,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  // ── reads ───────────────────────────────────────────────────────────────
  async listRuns(q: { page: number; limit: number }): Promise<Paginated<PayrollRunDto>> {
    const { items, total } = await this.repo.listRuns(this.tenantId, (q.page - 1) * q.limit, q.limit);
    return { items: await this.runDtos(items), total, page: q.page, limit: q.limit, totalPages: Math.max(1, Math.ceil(total / q.limit)) };
  }

  async runDetail(id: string): Promise<{ run: PayrollRunDto; payslips: PayslipDto[] }> {
    const run = await this.mustFindRun(id);
    return { run: (await this.runDtos([run]))[0]!, payslips: await this.payslipDtos(await this.repo.listByRun(this.tenantId, id)) };
  }

  async getPayslip(id: string): Promise<PayslipDto> {
    const p = await this.repo.findPayslip(this.tenantId, id);
    if (!p) throw new NotFoundError('Payslip not found.');
    return (await this.payslipDtos([p]))[0]!;
  }

  async mustFindRun(id: string): Promise<RunRow> {
    const run = await this.repo.findRun(this.tenantId, id);
    if (!run) throw new NotFoundError('Payroll run not found.');
    return run;
  }

  // ── generation ──────────────────────────────────────────────────────────
  async generate(input: { month: string; notes?: string }, actor: IamActor): Promise<{ run: PayrollRunDto; payslips: PayslipDto[]; skippedNoPay: number }> {
    if (input.month > currentMonth()) throw new ValidationError('Validation failed', { fields: [{ field: 'month', message: 'Payroll cannot be generated for a future month.' }] });
    if (await this.repo.findRunByMonth(this.tenantId, input.month)) throw new ConflictError(ErrorCode.CONFLICT, `A payroll run for ${monthLabel(input.month)} already exists.`);
    let run: RunRow;
    try {
      run = await this.repo.createRun({ tenantId: this.tenantId, month: input.month, notes: input.notes ?? null, createdBy: actor.userId });
    } catch {
      throw new ConflictError(ErrorCode.CONFLICT, `A payroll run for ${monthLabel(input.month)} already exists.`);
    }
    const { payable: employees, skippedNoPay } = splitByPay(await this.eligibleEmployees(input.month));
    const figures = await this.computeFor(employees, input.month, new Map());
    for (const e of employees) await this.insertPayslip(run, e, figures.get(e.id)!);
    await this.refreshTotals(run.id);
    await this.audit.record(actor, 'hr.payroll_generated', 'hr_payroll_run', run.id, { month: input.month, employees: employees.length, skippedNoPay: skippedNoPay.length });
    return { ...(await this.runDetail(run.id)), skippedNoPay: skippedNoPay.length };
  }

  async recalculate(id: string, actor: IamActor): Promise<{ run: PayrollRunDto; payslips: PayslipDto[]; skippedNoPay: number }> {
    const run = await this.mustFindRun(id);
    if (run.status !== 'DRAFT') throw new ConflictError(ErrorCode.INVALID_STATE, 'Only a draft payroll run can be recalculated.');
    const existing = await this.repo.listByRun(this.tenantId, id);
    const byUser = new Map(existing.map((p) => [p.userId, p]));
    // employees with no pay set get no payslip; one that already has a (draft) payslip keeps being recalculated
    const { payable, skippedNoPay } = splitByPay(await this.eligibleEmployees(run.month));
    const employees = [...payable, ...skippedNoPay.filter((e) => byUser.has(e.id))];
    const manual = new Map<string, ManualInputs>();
    for (const p of existing) manual.set(p.userId, { bonus: Number(p.bonus), advanceRecovery: Number(p.advanceRecovery), manualLines: linesOf(p).filter((l) => l.source === 'MANUAL') });
    const figures = await this.computeFor(employees, run.month, manual);
    for (const e of employees) {
      const f = figures.get(e.id)!;
      const prev = byUser.get(e.id);
      if (!prev) await this.insertPayslip(run, e, f);
      else if (prev.status === 'DRAFT') await this.repo.updatePayslip(prev.id, this.payslipColumns(e, f));
    }
    await this.refreshTotals(id);
    await this.audit.record(actor, 'hr.payroll_recalculated', 'hr_payroll_run', id, { month: run.month });
    return { ...(await this.runDetail(id)), skippedNoPay: skippedNoPay.filter((e) => !byUser.has(e.id)).length };
  }

  async deleteRun(id: string, actor: IamActor): Promise<void> {
    const run = await this.mustFindRun(id);
    if (run.status !== 'DRAFT') throw new ConflictError(ErrorCode.INVALID_STATE, 'Only a draft payroll run can be deleted.');
    await this.repo.deleteRun(id);
    await this.audit.record(actor, 'hr.payroll_deleted', 'hr_payroll_run', id, { month: run.month });
  }

  async approve(id: string, actor: IamActor): Promise<PayrollRunDto> {
    const run = await this.mustFindRun(id);
    if (run.status !== 'DRAFT') throw new ConflictError(ErrorCode.INVALID_STATE, 'Only a draft payroll run can be approved.');
    if (run.employeeCount === 0) throw new ConflictError(ErrorCode.INVALID_STATE, 'This run has no payslips.');
    if (!(await this.repo.approveRun(this.tenantId, id, actor.userId))) throw new ConflictError(ErrorCode.INVALID_STATE, 'This run was already approved.');
    await this.audit.record(actor, 'hr.payroll_approved', 'hr_payroll_run', id, { month: run.month, totalNet: Number(run.totalNet) });
    return (await this.runDtos([(await this.repo.findRun(this.tenantId, id))!]))[0]!;
  }

  async patchPayslip(id: string, input: { bonus?: number; advanceRecovery?: number; manualLines?: Array<{ name: string; type: 'ALLOWANCE' | 'DEDUCTION'; amount: number }>; remark?: string }, actor: IamActor): Promise<PayslipDto> {
    const p = await this.repo.findPayslip(this.tenantId, id);
    if (!p) throw new NotFoundError('Payslip not found.');
    const run = await this.mustFindRun(p.runId);
    if (run.status !== 'DRAFT' || p.status !== 'DRAFT') throw new ConflictError(ErrorCode.INVALID_STATE, 'Only draft payslips of a draft run can be edited.');
    const structure = linesOf(p).filter((l) => l.source === 'STRUCTURE');
    const manual: PayslipLineDto[] = input.manualLines ? input.manualLines.map((l) => ({ id: randomUUID(), name: l.name, type: l.type, amount: round2(l.amount), source: 'MANUAL' as const })) : linesOf(p).filter((l) => l.source === 'MANUAL');
    const extraAllowances = round2(manual.filter((l) => l.type === 'ALLOWANCE').reduce((a, l) => a + l.amount, 0));
    const extraDeductions = round2(manual.filter((l) => l.type === 'DEDUCTION').reduce((a, l) => a + l.amount, 0));
    const bonus = round2(input.bonus ?? Number(p.bonus));
    const advanceRecovery = round2(input.advanceRecovery ?? Number(p.advanceRecovery));
    const totals = totalsFrom({
      monthlyGross: Number(p.monthlyGross),
      attendanceDeduction: Number(p.attendanceDeduction),
      overtimePay: Number(p.overtimePay),
      extraAllowances,
      bonus,
      fixedDeductions: Number(p.fixedDeductions),
      extraDeductions,
      latePenalty: Number(p.latePenalty),
      advanceRecovery,
    });
    const updated = await this.repo.updatePayslip(id, { bonus, advanceRecovery, extraAllowances, extraDeductions, lines: [...structure, ...manual] as unknown as Prisma.InputJsonValue, ...totals });
    await this.refreshTotals(p.runId);
    await this.audit.record(actor, 'hr.payslip_updated', 'hr_payslip', id, { month: p.month, userId: p.userId, remark: input.remark ?? null, before: { bonus: Number(p.bonus), advanceRecovery: Number(p.advanceRecovery), netPay: Number(p.netPay) }, after: { bonus, advanceRecovery, netPay: totals.netPay } });
    return (await this.payslipDtos([updated]))[0]!;
  }

  // ── payment ─────────────────────────────────────────────────────────────
  async pay(id: string, input: { paymentMode: PayMode; paidOn?: string; remark?: string }, actor: IamActor): Promise<PayslipDto> {
    const p = await this.repo.findPayslip(this.tenantId, id);
    if (!p) throw new NotFoundError('Payslip not found.');
    if (p.status === 'PAID') throw new ConflictError(ErrorCode.ALREADY_PAID, 'This payslip has already been paid.');
    const run = await this.mustFindRun(p.runId);
    if (run.status !== 'APPROVED') throw new ConflictError(ErrorCode.INVALID_STATE, 'The payroll run must be approved before salaries can be paid.');
    const paidOn = input.paidOn ?? businessDate();
    if (paidOn > businessDate()) throw new ValidationError('Validation failed', { fields: [{ field: 'paidOn', message: 'The payment date cannot be in the future.' }] });

    // Guard part 1: atomic DRAFT -> PAID claim. A concurrent/second call loses here (409), BEFORE any expense is created.
    const claimed = await this.repo.claimPaid(this.tenantId, id, { paidAt: new Date(), paidOn: toDateCol(paidOn), paymentMode: input.paymentMode, paidBy: actor.userId, paidRemark: input.remark ?? null });
    if (!claimed) throw new ConflictError(ErrorCode.ALREADY_PAID, 'This payslip has already been paid.');

    const net = Number(p.netPay);
    let expenseId: string | null = null;
    try {
      if (net > 0) {
        // Guard part 2: payslips.expense_id is UNIQUE. One Expense row through the normal service so finance totals / audit stay consistent.
        const expense = await new ExpenseService(this.tenantId).create(
          { category: 'SALARY', amount: net, expenseDate: paidOn, description: `Salary – ${p.employeeName} – ${monthLabel(p.month)}` },
          actor,
        );
        expenseId = expense.id;
        await this.repo.updatePayslip(id, { expenseId });
      }
    } catch (err) {
      await this.repo.releaseClaim(id);
      throw err;
    }

    if ((await this.repo.countUnpaid(this.tenantId, p.runId)) === 0) await this.repo.updateRun(p.runId, { status: 'PAID', paidAt: new Date() });
    await this.audit.record(actor, 'hr.payslip_paid', 'hr_payslip', id, { month: p.month, userId: p.userId, netPay: net, paymentMode: input.paymentMode, paidOn, expenseId });
    await this.notifications.notify([p.userId], {
      type: 'PAYSLIP_PAID',
      title: 'Salary paid',
      body: `Your salary for ${monthLabel(p.month)} (₹${net.toFixed(2)}) has been marked paid via ${input.paymentMode.replace('_', ' ').toLowerCase()}.`,
      entityType: 'payslip',
      entityId: id,
    });
    return this.getPayslip(id);
  }

  async payAll(runId: string, input: { paymentMode: PayMode; paidOn?: string; remark?: string }, actor: IamActor) {
    const run = await this.mustFindRun(runId);
    if (run.status === 'DRAFT') throw new ConflictError(ErrorCode.INVALID_STATE, 'The payroll run must be approved before salaries can be paid.');
    const slips = await this.repo.listByRun(this.tenantId, runId);
    let paid = 0;
    let skipped = 0;
    const failed: Array<{ payslipId: string; message: string }> = [];
    for (const s of slips) {
      if (s.status === 'PAID') {
        skipped += 1;
        continue;
      }
      try {
        await this.pay(s.id, input, actor);
        paid += 1;
      } catch (err) {
        if (err instanceof AppError && err.code === ErrorCode.ALREADY_PAID) skipped += 1;
        else failed.push({ payslipId: s.id, message: err instanceof Error ? err.message : 'Payment failed.' });
      }
    }
    return { paid, skipped, failed, run: (await this.runDtos([(await this.repo.findRun(this.tenantId, runId))!]))[0]! };
  }

  // ── self ────────────────────────────────────────────────────────────────
  async listMine(userId: string, q: { page: number; limit: number }): Promise<Paginated<PayslipSummaryDto>> {
    await this.access.requireSelf(userId);
    const { items, total } = await this.repo.listForUser(this.tenantId, userId, { visibleOnly: true, skip: (q.page - 1) * q.limit, take: q.limit });
    const refs = await this.employees.refsFor(this.tenantId, [userId]);
    const ref = refs.get(userId)!;
    return { items: items.map((p) => this.summaryOf(p, ref)), total, page: q.page, limit: q.limit, totalPages: Math.max(1, Math.ceil(total / q.limit)) };
  }

  async getMine(userId: string, id: string): Promise<PayslipDto> {
    await this.access.requireSelf(userId);
    const p = await this.repo.findWithRun(this.tenantId, id);
    if (!p || p.userId !== userId || p.run.status === 'DRAFT') throw new NotFoundError('Payslip not found.');
    return (await this.payslipDtos([p]))[0]!;
  }

  async latestVisibleFor(userId: string): Promise<PayslipSummaryDto | null> {
    const { items } = await this.repo.listForUser(this.tenantId, userId, { visibleOnly: true, skip: 0, take: 1 });
    if (!items[0]) return null;
    return this.summaryOf(items[0], (await this.employees.refsFor(this.tenantId, [userId])).get(userId)!);
  }

  async summariesForUsers(userId: string, take: number): Promise<PayslipSummaryDto[]> {
    const { items } = await this.repo.listForUser(this.tenantId, userId, { visibleOnly: false, skip: 0, take });
    const ref = (await this.employees.refsFor(this.tenantId, [userId])).get(userId);
    return ref ? items.map((p) => this.summaryOf(p, ref)) : [];
  }

  async statusFor(month: string): Promise<{ month: string; runId: string | null; status: 'NOT_GENERATED' | 'DRAFT' | 'APPROVED' | 'PAID'; totalNet: number | null; unpaidPayslips: number | null }> {
    const run = await this.repo.findRunByMonth(this.tenantId, month);
    if (!run) return { month, runId: null, status: 'NOT_GENERATED', totalNet: null, unpaidPayslips: null };
    return { month, runId: run.id, status: run.status, totalNet: Number(run.totalNet), unpaidPayslips: await this.repo.countUnpaid(this.tenantId, run.id) };
  }

  // ── internals ───────────────────────────────────────────────────────────
  private async eligibleEmployees(month: string): Promise<EmployeeRow[]> {
    const { items } = await this.employees.list(this.tenantId, {});
    return items.filter((e) => fromDateCol(e.staffProfile.joiningDate) <= monthEnd(month));
  }

  private async computeFor(employees: EmployeeRow[], month: string, manual: Map<string, ManualInputs>): Promise<Map<string, PayrollFigures & { lines: PayslipLineDto[] }>> {
    const policy = await this.config.getPolicyRow();
    const ctxs = await this.calendar.contexts(employees, policy);
    const from = monthStart(month);
    const to = monthEnd(month);
    const ids = employees.map((e) => e.id);
    const [rows, holidays, components] = await Promise.all([
      this.attendanceRepo.rowsForRange(this.tenantId, from, to, ids),
      this.config.repo.listHolidays(this.tenantId, from, to),
      this.employees.listComponents(this.tenantId, ids),
    ]);
    const today = businessDate();
    const out = new Map<string, PayrollFigures & { lines: PayslipLineDto[] }>();
    for (const e of employees) {
      const ctx: EmployeeCtx = ctxs.get(e.id)!;
      const rowMap = new Map<string, PayrollAttendanceRow>();
      for (const r of rows.filter((x) => x.userId === e.id)) {
        rowMap.set(fromDateCol(r.date), { status: r.status, leave: r.leaveRequest ? { isPaid: r.leaveRequest.leaveType.isPaid } : null, overtimeMinutes: r.overtimeMinutes });
      }
      const mine = components.filter((c) => c.userId === e.id && c.isActive);
      const structure: PayslipLineDto[] = mine.map((c) => ({ id: c.id, name: c.name, type: c.type, amount: Number(c.amount), source: 'STRUCTURE' as const }));
      const m = manual.get(e.id) ?? { bonus: 0, advanceRecovery: 0, manualLines: [] };
      const figures = computePayslip({
        month,
        today,
        joiningDate: ctx.joiningDate,
        weeklyOff: ctx.weeklyOff,
        holidays: this.calendar.holidayMap(ctx, holidays),
        rows: rowMap,
        salaryType: ctx.salaryType as PayrollSalaryType,
        salaryAmount: ctx.salaryAmount,
        allowances: structure.filter((l) => l.type === 'ALLOWANCE'),
        deductions: structure.filter((l) => l.type === 'DEDUCTION'),
        manualAllowances: m.manualLines.filter((l) => l.type === 'ALLOWANCE').reduce((a, l) => a + l.amount, 0),
        manualDeductions: m.manualLines.filter((l) => l.type === 'DEDUCTION').reduce((a, l) => a + l.amount, 0),
        bonus: m.bonus,
        advanceRecovery: m.advanceRecovery,
        policy: {
          standardDayHours: Number(policy.standardDayHours),
          latePenaltyEnabled: policy.latePenaltyEnabled,
          latePenaltyLatesPerUnit: policy.latePenaltyLatesPerUnit,
          latePenaltyDays: Number(policy.latePenaltyDays),
          overtimeEnabled: policy.overtimeEnabled,
          overtimeMultiplier: Number(policy.overtimeMultiplier),
        },
      });
      out.set(e.id, { ...figures, lines: [...structure, ...m.manualLines] });
    }
    return out;
  }

  private payslipColumns(e: EmployeeRow, f: PayrollFigures & { lines: PayslipLineDto[] }): Prisma.HrPayslipUncheckedUpdateInput {
    return {
      employeeCode: e.staffProfile.employeeId,
      employeeName: e.name,
      salaryType: e.staffProfile.salaryType,
      workingDays: f.workingDays,
      presentDays: f.presentDays,
      halfDays: f.halfDays,
      paidLeaveDays: f.paidLeaveDays,
      unpaidLeaveDays: f.unpaidLeaveDays,
      absentDays: f.absentDays,
      holidayDays: f.holidayDays,
      weeklyOffDays: f.weeklyOffDays,
      notEmployedDays: f.notEmployedDays,
      lateCount: f.lateCount,
      overtimeMinutes: f.overtimeMinutes,
      unpaidDays: f.unpaidDays,
      dailyRate: f.dailyRate,
      baseSalary: f.baseSalary,
      fixedAllowances: f.fixedAllowances,
      monthlyGross: f.monthlyGross,
      attendanceDeduction: f.attendanceDeduction,
      overtimePay: f.overtimePay,
      extraAllowances: f.extraAllowances,
      bonus: f.bonus,
      grossEarnings: f.grossEarnings,
      fixedDeductions: f.fixedDeductions,
      extraDeductions: f.extraDeductions,
      latePenalty: f.latePenalty,
      advanceRecovery: f.advanceRecovery,
      totalDeductions: f.totalDeductions,
      netPay: f.netPay,
      lines: f.lines as unknown as Prisma.InputJsonValue,
      notes: f.notes as unknown as Prisma.InputJsonValue,
    };
  }

  private async insertPayslip(run: RunRow, e: EmployeeRow, f: PayrollFigures & { lines: PayslipLineDto[] }): Promise<void> {
    const cols = this.payslipColumns(e, f) as Prisma.HrPayslipUncheckedCreateInput;
    await this.repo.createPayslip({ ...cols, tenantId: this.tenantId, runId: run.id, userId: e.id, month: run.month, roleName: (await this.employees.refsFor(this.tenantId, [e.id])).get(e.id)?.role ?? 'STAFF' });
  }

  private async refreshTotals(runId: string): Promise<void> {
    const slips = await this.repo.listByRun(this.tenantId, runId);
    await this.repo.updateRun(runId, {
      employeeCount: slips.length,
      totalGross: round2(slips.reduce((a, s) => a + Number(s.grossEarnings), 0)),
      totalDeductions: round2(slips.reduce((a, s) => a + Number(s.totalDeductions), 0)),
      totalNet: round2(slips.reduce((a, s) => a + Number(s.netPay), 0)),
    });
  }
}
