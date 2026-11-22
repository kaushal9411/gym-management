import { describe, expect, it } from 'vitest';

import { computePayslip, totalsFrom, type PayrollAttendanceRow, type PayrollInput } from './payroll.util';

const policy = { standardDayHours: 8, latePenaltyEnabled: false, latePenaltyLatesPerUnit: 3, latePenaltyDays: 0.5, overtimeEnabled: false, overtimeMultiplier: 1.5 };

/** Mark every Mon-Sat working day of `month` between from..to PRESENT (Sundays are the weekly off). */
function presentRows(month: string, fromDay: number, toDay: number, extra: Record<string, PayrollAttendanceRow> = {}): Map<string, PayrollAttendanceRow> {
  const rows = new Map<string, PayrollAttendanceRow>();
  for (let d = fromDay; d <= toDay; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue;
    rows.set(date, { status: 'PRESENT', leave: null, overtimeMinutes: 0 });
  }
  for (const [k, v] of Object.entries(extra)) rows.set(k, v);
  return rows;
}

const base = (over: Partial<PayrollInput> = {}): PayrollInput => ({
  month: '2026-11',
  today: '2026-12-01',
  joiningDate: '2026-01-01',
  weeklyOff: new Set(['SUNDAY']),
  holidays: new Map(),
  rows: presentRows('2026-11', 1, 30),
  salaryType: 'MONTHLY',
  salaryAmount: 18000,
  allowances: [{ amount: 1500 }],
  deductions: [{ amount: 500 }],
  manualAllowances: 0,
  manualDeductions: 0,
  bonus: 0,
  advanceRecovery: 0,
  policy,
  ...over,
});

describe('payroll formula', () => {
  it('a full-attendance month pays gross minus fixed deductions (30-day month, 25 working days)', () => {
    const p = computePayslip(base());
    expect(p.workingDays).toBe(25); // 30 days - 5 Sundays (1, 8, 15, 22, 29)
    expect(p.weeklyOffDays).toBe(5);
    expect(p.monthlyGross).toBe(19500);
    expect(p.dailyRate).toBe(780);
    expect(p.unpaidDays).toBe(0);
    expect(p.attendanceDeduction).toBe(0);
    expect(p.netPay).toBe(19000);
  });

  it('the worked example: 1 absent + 1 half-day = 1.5 unpaid days => 1170 off, net 18330 - 500', () => {
    const rows = presentRows('2026-11', 1, 30, {
      '2026-11-10': { status: 'ABSENT', leave: null, overtimeMinutes: 0 },
      '2026-11-12': { status: 'HALF_DAY', leave: null, overtimeMinutes: 0 },
    });
    const p = computePayslip(base({ rows }));
    expect(p.absentDays).toBe(1);
    expect(p.halfDays).toBe(1);
    expect(p.unpaidDays).toBe(1.5);
    expect(p.attendanceDeduction).toBe(1170);
    expect(p.grossEarnings).toBe(18330);
    expect(p.netPay).toBe(17830);
  });

  it('a 31-day month uses 31 - weekly offs as the denominator', () => {
    // Dec 2026: Sundays 6, 13, 20, 27 => 27 working days
    const rows = presentRows('2026-12', 1, 31);
    const p = computePayslip(base({ month: '2026-12', today: '2027-01-02', rows, salaryAmount: 27000, allowances: [], deductions: [] }));
    expect(p.workingDays).toBe(27);
    expect(p.dailyRate).toBe(1000);
    expect(p.netPay).toBe(27000);
  });

  it('paid leave costs nothing, unpaid leave costs the day, half-day unpaid leave costs half', () => {
    const rows = presentRows('2026-11', 1, 30, {
      '2026-11-03': { status: 'ON_LEAVE', leave: { isPaid: true }, overtimeMinutes: 0 },
      '2026-11-04': { status: 'ON_LEAVE', leave: { isPaid: false }, overtimeMinutes: 0 },
      '2026-11-05': { status: 'HALF_DAY', leave: { isPaid: false }, overtimeMinutes: 0 },
      '2026-11-06': { status: 'HALF_DAY', leave: { isPaid: true }, overtimeMinutes: 0 },
      '2026-11-07': { status: 'ON_LEAVE', leave: null, overtimeMinutes: 0 }, // manual ON_LEAVE = paid
    });
    const p = computePayslip(base({ rows }));
    expect(p.paidLeaveDays).toBe(2.5);
    expect(p.unpaidLeaveDays).toBe(1.5);
    expect(p.unpaidDays).toBe(1.5);
    expect(p.attendanceDeduction).toBe(1170);
  });

  it('holidays are paid and stay in the working-day count', () => {
    const p = computePayslip(base({ holidays: new Map([['2026-11-09', 'Govardhan Puja']]), rows: presentRows('2026-11', 1, 30, { '2026-11-09': { status: 'ABSENT', leave: null, overtimeMinutes: 0 } }) }));
    expect(p.holidayDays).toBe(1);
    expect(p.workingDays).toBe(25);
    expect(p.unpaidDays).toBe(0);
  });

  it('days with no row before today are absent; today and the future are not', () => {
    const rows = new Map<string, PayrollAttendanceRow>(); // nothing marked at all
    const p = computePayslip(base({ rows, today: '2026-11-11' }));
    // working days before the 11th: 2,3,4,5,6,7 and 9,10 = 8 (Sundays 1 and 8 are off)
    expect(p.absentDays).toBe(8);
    expect(p.unpaidDays).toBe(8);
    expect(p.attendanceDeduction).toBe(6240);
  });

  it('joining mid-month: days before the joining date are unpaid, working-day denominator unchanged', () => {
    // joins Wed 11 Nov; working days 2..7 and 9, 10 = 8 are before joining
    const rows = presentRows('2026-11', 11, 30);
    const p = computePayslip(base({ joiningDate: '2026-11-11', rows }));
    expect(p.notEmployedDays).toBe(8);
    expect(p.workingDays).toBe(25);
    expect(p.unpaidDays).toBe(8);
    expect(p.attendanceDeduction).toBe(6240);
    expect(p.netPay).toBe(19500 - 6240 - 500);
  });

  it('never deducts more than the gross and never goes negative', () => {
    const p = computePayslip(base({ rows: new Map(), today: '2026-12-01', deductions: [{ amount: 5000 }] }));
    expect(p.attendanceDeduction).toBeLessThanOrEqual(p.monthlyGross);
    expect(p.netPay).toBe(0);
  });

  it('late penalty and overtime are policy switches, default off', () => {
    const rows = presentRows('2026-11', 1, 30);
    for (const d of ['02', '03', '04', '05', '06', '07', '09']) rows.set(`2026-11-${d}`, { status: 'LATE', leave: null, overtimeMinutes: 60 });
    const off = computePayslip(base({ rows }));
    expect(off.lateCount).toBe(7);
    expect(off.latePenalty).toBe(0);
    expect(off.overtimePay).toBe(0);

    const on = computePayslip(base({ rows, policy: { ...policy, latePenaltyEnabled: true, overtimeEnabled: true } }));
    expect(on.latePenalty).toBe(780); // floor(7/3)=2 units x 0.5 day x 780
    expect(on.overtimePay).toBe(1023.75); // 7h x (780/8) x 1.5
    expect(on.netPay).toBe(19500 + 1023.75 - 500 - 780);
  });

  it('daily and hourly salary types are converted to a monthly equivalent; per-session needs a manual line', () => {
    expect(computePayslip(base({ salaryType: 'DAILY', salaryAmount: 600, allowances: [], deductions: [] })).baseSalary).toBe(15000);
    expect(computePayslip(base({ salaryType: 'HOURLY', salaryAmount: 100, allowances: [], deductions: [] })).baseSalary).toBe(20000);
    const ps = computePayslip(base({ salaryType: 'PER_SESSION', salaryAmount: 500, allowances: [], deductions: [] }));
    expect(ps.baseSalary).toBe(0);
    expect(ps.notes.join(' ')).toMatch(/PER_SESSION/);
  });

  it('a missing salary yields a zero payslip with a note instead of failing', () => {
    const p = computePayslip(base({ salaryAmount: null, allowances: [], deductions: [] }));
    expect(p.monthlyGross).toBe(0);
    expect(p.netPay).toBe(0);
    expect(p.notes.length).toBe(1);
  });

  it('manual lines, bonus and advance recovery flow into gross / deductions', () => {
    const p = computePayslip(base({ manualAllowances: 750, manualDeductions: 300, bonus: 500, advanceRecovery: 1000 }));
    expect(p.grossEarnings).toBe(19500 + 750 + 500);
    expect(p.totalDeductions).toBe(500 + 300 + 1000);
    expect(p.netPay).toBe(20750 - 1800);
  });
});

describe('totalsFrom', () => {
  it('clamps net at zero', () => {
    expect(totalsFrom({ monthlyGross: 1000, attendanceDeduction: 0, overtimePay: 0, extraAllowances: 0, bonus: 0, fixedDeductions: 400, extraDeductions: 700, latePenalty: 0, advanceRecovery: 0 }).netPay).toBe(0);
  });
});
