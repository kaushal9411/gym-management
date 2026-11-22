/**
 * Payroll arithmetic — PURE, deterministic, no I/O. Documented in
 * docs/HR-API-CONTRACT.md §9 and BACKEND-GUIDE "HR module".
 *
 *   workingDays   = calendar days of the month - weekly-off days (holidays stay: they are paid)
 *   monthlyGross  = base + Σ active allowances
 *   dailyRate     = round2(monthlyGross / workingDays)
 *   unpaidDays    = Σ per working day loss (absent 1, half-day 0.5, unpaid leave, not-yet-employed 1)
 *   attendanceDeduction = round2(min(monthlyGross, dailyRate × unpaidDays))
 *   latePenalty   = enabled ? floor(lates / N) × penaltyDays × dailyRate : 0
 *   overtimePay   = enabled ? round2(otMinutes/60 × dailyRate/standardDayHours × multiplier) : 0
 *   gross         = monthlyGross - attendanceDeduction + overtimePay + extraAllowances + bonus
 *   deductions    = fixedDeductions + extraDeductions + latePenalty + advanceRecovery
 *   net           = max(0, gross - deductions)
 */
import { daysInMonth, eachDate, monthEnd, monthStart, round1, round2, weekdayOf } from './hr-dates.util';

export type PayrollSalaryType = 'MONTHLY' | 'DAILY' | 'HOURLY' | 'PER_SESSION';

export interface PayrollAttendanceRow {
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'WEEKLY_OFF' | 'HOLIDAY';
  /** Set when the row was written by an approved leave request. */
  leave: { isPaid: boolean } | null;
  overtimeMinutes: number;
}

export interface PayrollPolicy {
  standardDayHours: number;
  latePenaltyEnabled: boolean;
  latePenaltyLatesPerUnit: number;
  latePenaltyDays: number;
  overtimeEnabled: boolean;
  overtimeMultiplier: number;
}

export interface PayrollInput {
  month: string;
  /** IST business date "today" — days before it with no row are absent. */
  today: string;
  joiningDate: string;
  weeklyOff: ReadonlySet<string>;
  /** date -> holiday name, already filtered to the employee's branches. */
  holidays: ReadonlyMap<string, string>;
  rows: ReadonlyMap<string, PayrollAttendanceRow>;
  salaryType: PayrollSalaryType;
  salaryAmount: number | null;
  allowances: ReadonlyArray<{ amount: number }>;
  deductions: ReadonlyArray<{ amount: number }>;
  manualAllowances: number;
  manualDeductions: number;
  bonus: number;
  advanceRecovery: number;
  policy: PayrollPolicy;
}

export interface PayrollFigures {
  workingDays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  holidayDays: number;
  weeklyOffDays: number;
  notEmployedDays: number;
  lateCount: number;
  overtimeMinutes: number;
  unpaidDays: number;
  dailyRate: number;
  baseSalary: number;
  fixedAllowances: number;
  monthlyGross: number;
  attendanceDeduction: number;
  overtimePay: number;
  extraAllowances: number;
  bonus: number;
  grossEarnings: number;
  fixedDeductions: number;
  extraDeductions: number;
  latePenalty: number;
  advanceRecovery: number;
  totalDeductions: number;
  netPay: number;
  notes: string[];
}

const sum = (list: ReadonlyArray<{ amount: number }>): number => round2(list.reduce((a, b) => a + b.amount, 0));

export interface TotalsInput {
  monthlyGross: number;
  attendanceDeduction: number;
  overtimePay: number;
  extraAllowances: number;
  bonus: number;
  fixedDeductions: number;
  extraDeductions: number;
  latePenalty: number;
  advanceRecovery: number;
}

/** Gross / total deductions / net from already-computed components (also used when only manual lines change). */
export function totalsFrom(t: TotalsInput): { grossEarnings: number; totalDeductions: number; netPay: number } {
  const grossEarnings = round2(t.monthlyGross - t.attendanceDeduction + t.overtimePay + t.extraAllowances + t.bonus);
  const totalDeductions = round2(t.fixedDeductions + t.extraDeductions + t.latePenalty + t.advanceRecovery);
  return { grossEarnings, totalDeductions, netPay: Math.max(0, round2(grossEarnings - totalDeductions)) };
}

export function computePayslip(input: PayrollInput): PayrollFigures {
  const notes: string[] = [];
  const dates = eachDate(monthStart(input.month), monthEnd(input.month));
  const calendarDays = daysInMonth(input.month);

  let weeklyOffDays = 0;
  let holidayDays = 0;
  let notEmployedDays = 0;
  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let lateCount = 0;
  let overtimeMinutes = 0;
  let loss = 0;

  for (const date of dates) {
    if (input.weeklyOff.has(weekdayOf(date))) {
      weeklyOffDays += 1;
      continue;
    }
    if (date < input.joiningDate) {
      notEmployedDays += 1;
      loss += 1;
      continue;
    }
    if (input.holidays.has(date)) {
      holidayDays += 1;
      continue;
    }
    const row = input.rows.get(date);
    if (!row) {
      if (date < input.today) {
        absentDays += 1;
        loss += 1;
      }
      continue; // today / future with no row: not counted, not a loss
    }
    overtimeMinutes += row.overtimeMinutes;
    switch (row.status) {
      case 'PRESENT':
        presentDays += 1;
        break;
      case 'LATE':
        presentDays += 1;
        lateCount += 1;
        break;
      case 'HALF_DAY':
        if (row.leave) {
          if (row.leave.isPaid) paidLeaveDays += 0.5;
          else {
            unpaidLeaveDays += 0.5;
            loss += 0.5;
          }
        } else {
          halfDays += 1;
          loss += 0.5;
        }
        break;
      case 'ON_LEAVE':
        if (!row.leave || row.leave.isPaid) paidLeaveDays += 1;
        else {
          unpaidLeaveDays += 1;
          loss += 1;
        }
        break;
      case 'ABSENT':
        absentDays += 1;
        loss += 1;
        break;
      default:
        break; // WEEKLY_OFF / HOLIDAY rows on a working day: HR override, neutral
    }
  }

  const workingDays = calendarDays - weeklyOffDays;

  let baseSalary = 0;
  const amount = input.salaryAmount;
  if (amount === null) {
    notes.push('Base salary is not set; payslip base is 0.');
  } else if (input.salaryType === 'MONTHLY') {
    baseSalary = amount;
  } else if (input.salaryType === 'DAILY') {
    baseSalary = round2(amount * workingDays);
  } else if (input.salaryType === 'HOURLY') {
    baseSalary = round2(amount * input.policy.standardDayHours * workingDays);
  } else {
    notes.push('PER_SESSION salary is not computed automatically; add the earned amount as a manual allowance.');
  }

  const fixedAllowances = sum(input.allowances);
  const fixedDeductions = sum(input.deductions);
  const monthlyGross = round2(baseSalary + fixedAllowances);
  const dailyRate = workingDays > 0 ? round2(monthlyGross / workingDays) : 0;
  const unpaidDays = round1(loss);
  const attendanceDeduction = round2(Math.min(monthlyGross, dailyRate * unpaidDays));

  const latePenalty =
    input.policy.latePenaltyEnabled && input.policy.latePenaltyLatesPerUnit > 0
      ? round2(Math.floor(lateCount / input.policy.latePenaltyLatesPerUnit) * input.policy.latePenaltyDays * dailyRate)
      : 0;
  const overtimePay =
    input.policy.overtimeEnabled && input.policy.standardDayHours > 0
      ? round2((overtimeMinutes / 60) * (dailyRate / input.policy.standardDayHours) * input.policy.overtimeMultiplier)
      : 0;

  const extraAllowances = round2(input.manualAllowances);
  const extraDeductions = round2(input.manualDeductions);
  const totals = totalsFrom({
    monthlyGross,
    attendanceDeduction,
    overtimePay,
    extraAllowances,
    bonus: input.bonus,
    fixedDeductions,
    extraDeductions,
    latePenalty,
    advanceRecovery: input.advanceRecovery,
  });

  return {
    workingDays,
    presentDays: round1(presentDays),
    halfDays: round1(halfDays),
    paidLeaveDays: round1(paidLeaveDays),
    unpaidLeaveDays: round1(unpaidLeaveDays),
    absentDays: round1(absentDays),
    holidayDays,
    weeklyOffDays,
    notEmployedDays,
    lateCount,
    overtimeMinutes,
    unpaidDays,
    dailyRate,
    baseSalary,
    fixedAllowances,
    monthlyGross,
    attendanceDeduction,
    overtimePay,
    extraAllowances,
    bonus: round2(input.bonus),
    grossEarnings: totals.grossEarnings,
    fixedDeductions,
    extraDeductions,
    latePenalty,
    advanceRecovery: round2(input.advanceRecovery),
    totalDeductions: totals.totalDeductions,
    netPay: totals.netPay,
    notes,
  };
}
