import { describe, expect, it } from 'vitest';

import type { MemberProfile } from '../repositories/audience.repository';

import { contactProblem, decideSeed, isOptedOut, normalisePhone } from './recipient-plan.util';

function profile(over: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: 'm1',
    memberCode: 'MEM-0001',
    firstName: 'Aarav',
    lastName: 'Kapoor',
    email: 'aarav@example.com',
    phone: '9876543210',
    branchId: 'b1',
    branchName: 'Main',
    timezone: 'Asia/Kolkata',
    planName: 'Monthly',
    endDate: new Date('2026-10-26T00:00:00Z'),
    amountDue: 0,
    deviceTokens: ['tok'],
    optedOut: new Set(),
    messageable: true,
    ...over,
  };
}

const NOON_IST = new Date('2026-10-19T06:30:00Z');
const NIGHT_IST = new Date('2026-10-19T16:30:00Z'); // 22:00 IST

describe('normalisePhone', () => {
  it('turns a bare 10-digit Indian number into E.164', () => {
    expect(normalisePhone('98765 43210')).toBe('+919876543210');
    expect(normalisePhone('+91 98765-43210')).toBe('+919876543210');
  });
  it('rejects things that cannot be a phone number', () => {
    expect(normalisePhone('12345')).toBeNull();
    expect(normalisePhone('')).toBeNull();
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone('abc')).toBeNull();
  });
});

describe('contactProblem', () => {
  it('names what is missing per channel', () => {
    expect(contactProblem(profile({ email: null }), 'EMAIL')).toMatch(/email/i);
    expect(contactProblem(profile({ phone: null }), 'SMS')).toMatch(/No phone/);
    expect(contactProblem(profile({ phone: '123' }), 'WHATSAPP')).toMatch(/not valid/);
    expect(contactProblem(profile({ deviceTokens: [] }), 'PUSH')).toMatch(/device/);
  });
  it('in-app only needs a member', () => {
    expect(contactProblem(profile({ email: null, phone: null, deviceTokens: [] }), 'IN_APP')).toBeNull();
  });
});

describe('decideSeed', () => {
  it('opted-out members are skipped on that channel only', () => {
    const p = profile({ optedOut: new Set(['SMS']) });
    expect(decideSeed(p, 'SMS', true, NOON_IST)).toMatchObject({ status: 'SKIPPED_OPTED_OUT' });
    expect(decideSeed(p, 'EMAIL', true, NOON_IST)).toMatchObject({ status: 'QUEUED' });
  });

  it('the in-app inbox can never be opted out of', () => {
    expect(isOptedOut(profile({ optedOut: new Set(['IN_APP']) }), 'IN_APP')).toBe(false);
  });

  it('opt-out wins over a missing contact (reported as opted out)', () => {
    expect(decideSeed(profile({ phone: null, optedOut: new Set(['SMS']) }), 'SMS', true, NOON_IST).status).toBe('SKIPPED_OPTED_OUT');
  });

  it('no contact => SKIPPED_NO_CONTACT with a reason', () => {
    const seed = decideSeed(profile({ email: null }), 'EMAIL', true, NOON_IST);
    expect(seed.status).toBe('SKIPPED_NO_CONTACT');
    expect(seed.error).toBeTruthy();
  });

  it('SMS / WhatsApp sent at night are held until 08:00 member-local when quiet hours are on', () => {
    const sms = decideSeed(profile(), 'SMS', true, NIGHT_IST);
    expect(sms.status).toBe('QUEUED');
    expect(sms.deliverAfter?.toISOString()).toBe('2026-10-20T02:30:00.000Z');
    expect(decideSeed(profile(), 'WHATSAPP', true, NIGHT_IST).deliverAfter?.toISOString()).toBe('2026-10-20T02:30:00.000Z');
  });

  it('push / in-app / email are never held, and holdQuietHours=false sends SMS at once', () => {
    for (const ch of ['PUSH', 'IN_APP', 'EMAIL'] as const) expect(decideSeed(profile(), ch, true, NIGHT_IST).deliverAfter ?? null).toBeNull();
    expect(decideSeed(profile(), 'SMS', false, NIGHT_IST).deliverAfter ?? null).toBeNull();
  });

  it('daytime SMS is not held', () => {
    expect(decideSeed(profile(), 'SMS', true, NOON_IST).deliverAfter ?? null).toBeNull();
  });

  it('uses the member timezone for the hold', () => {
    // 22:00 IST is 12:30 in New York: a New York member is not held
    expect(decideSeed(profile({ timezone: 'America/New_York' }), 'SMS', true, NIGHT_IST).deliverAfter ?? null).toBeNull();
  });
});
