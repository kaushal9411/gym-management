import { describe, expect, it } from 'vitest';

import {
  adjustBalanceBodySchema,
  applyLeaveBodySchema,
  bulkAttendanceBodySchema,
  createLeaveTypeBodySchema,
  createShiftBodySchema,
  markAttendanceBodySchema,
  patchPayslipBodySchema,
  payBodySchema,
  rejectLeaveBodySchema,
  updatePolicyBodySchema,
} from './hr.validators';

const uuid = '3f0f0c1e-4c1d-4f61-8e5e-1a2b3c4d5e6f';

describe('leave validators', () => {
  it('apply defaults the day part and requires a real reason', () => {
    const ok = applyLeaveBodySchema.parse({ leaveTypeId: uuid, startDate: '2026-11-25', reason: 'Family function' });
    expect(ok.dayPart).toBe('FULL_DAY');
    expect(applyLeaveBodySchema.safeParse({ leaveTypeId: uuid, startDate: '2026-11-25', reason: 'a' }).success).toBe(false);
    expect(applyLeaveBodySchema.safeParse({ leaveTypeId: uuid, startDate: '25-11-2026', reason: 'Family function' }).success).toBe(false);
    expect(applyLeaveBodySchema.safeParse({ leaveTypeId: uuid, startDate: '2026-11-25', dayPart: 'QUARTER', reason: 'Family function' }).success).toBe(false);
  });

  it('rejecting REQUIRES a remark; approving does not', () => {
    expect(rejectLeaveBodySchema.safeParse({}).success).toBe(false);
    expect(rejectLeaveBodySchema.safeParse({ remark: '  ' }).success).toBe(false);
    expect(rejectLeaveBodySchema.safeParse({ remark: 'Peak week' }).success).toBe(true);
  });

  it('balance adjustments need a non-zero signed amount and a remark', () => {
    expect(adjustBalanceBodySchema.safeParse({ userId: uuid, leaveTypeId: uuid, days: 0, remark: 'zero' }).success).toBe(false);
    expect(adjustBalanceBodySchema.safeParse({ userId: uuid, leaveTypeId: uuid, days: -1.5, remark: 'penalty' }).success).toBe(true);
    expect(adjustBalanceBodySchema.safeParse({ userId: uuid, leaveTypeId: uuid, days: 2 }).success).toBe(false);
  });

  it('leave types normalise the code and default to paid, no quota limit', () => {
    const t = createLeaveTypeBodySchema.parse({ name: 'Comp Off', code: 'comp' });
    expect(t).toMatchObject({ code: 'COMP', isPaid: true, yearlyQuota: null, carryForward: false });
    expect(createLeaveTypeBodySchema.safeParse({ name: 'x', code: 'bad code!' }).success).toBe(false);
  });
});

describe('attendance validators', () => {
  it('manual marking requires a remark and valid HH:mm times', () => {
    expect(markAttendanceBodySchema.safeParse({ userId: uuid, date: '2026-11-20', status: 'PRESENT' }).success).toBe(false);
    expect(markAttendanceBodySchema.safeParse({ userId: uuid, date: '2026-11-20', status: 'PRESENT', remark: 'ok' }).success).toBe(false);
    expect(markAttendanceBodySchema.safeParse({ userId: uuid, date: '2026-11-20', status: 'PRESENT', checkInTime: '25:00', remark: 'bad time' }).success).toBe(false);
    expect(markAttendanceBodySchema.safeParse({ userId: uuid, date: '2026-11-20', status: 'PRESENT', checkInTime: '06:10', remark: 'Forgot to punch' }).success).toBe(true);
  });

  it('bulk needs a shared remark and between 1 and 200 entries', () => {
    expect(bulkAttendanceBodySchema.safeParse({ date: '2026-11-20', remark: 'Power cut', entries: [] }).success).toBe(false);
    expect(bulkAttendanceBodySchema.safeParse({ date: '2026-11-20', entries: [{ userId: uuid, status: 'PRESENT' }] }).success).toBe(false);
    expect(bulkAttendanceBodySchema.safeParse({ date: '2026-11-20', remark: 'Power cut', entries: [{ userId: uuid, status: 'PRESENT' }] }).success).toBe(true);
  });
});

describe('settings / payroll validators', () => {
  it('shifts default to a 10 minute grace and a Sunday off', () => {
    expect(createShiftBodySchema.parse({ name: 'Morning', startTime: '06:00', endTime: '14:00' })).toMatchObject({ graceMinutes: 10, weeklyOffDays: ['SUNDAY'], isDefault: false });
  });

  it('policy updates are partial and bounded', () => {
    expect(updatePolicyBodySchema.safeParse({ latePenaltyEnabled: true }).success).toBe(true);
    expect(updatePolicyBodySchema.safeParse({ leaveYearStartMonth: 13 }).success).toBe(false);
    expect(updatePolicyBodySchema.safeParse({ overtimeMultiplier: 0.5 }).success).toBe(false);
  });

  it('payslip edits only accept positive manual lines', () => {
    expect(patchPayslipBodySchema.safeParse({ manualLines: [{ name: 'Incentive', type: 'ALLOWANCE', amount: 0 }] }).success).toBe(false);
    expect(patchPayslipBodySchema.safeParse({ bonus: 500, advanceRecovery: 1000, manualLines: [{ name: 'Incentive', type: 'ALLOWANCE', amount: 750 }] }).success).toBe(true);
  });

  it('paying needs a known payment mode', () => {
    expect(payBodySchema.safeParse({ paymentMode: 'BITCOIN' }).success).toBe(false);
    expect(payBodySchema.safeParse({ paymentMode: 'UPI', paidOn: '2026-12-01' }).success).toBe(true);
  });
});
