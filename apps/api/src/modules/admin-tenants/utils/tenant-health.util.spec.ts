import { describe, expect, it } from 'vitest';

import {
  computeHealth,
  distributionBucket,
  healthBucket,
  healthDistribution,
  type HealthInputs,
} from './tenant-health.util';

const now = new Date('2026-10-04T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

const base: HealthInputs = {
  tenantStatus: 'ACTIVE',
  subscriptionStatus: 'ACTIVE',
  trialEndsAt: null,
  paymentFailed: false,
  lastActiveAt: ago(0.5),
  attendanceRecent: 400,
  members: 200,
  membersUtilisation: 0.5,
  maxUtilisation: 0.5,
  paid: true,
  openTickets: 0,
  createdAt: ago(200),
};

describe('computeHealth', () => {
  it('scores a busy, paid-up, healthy tenant 100', () => {
    const r = computeHealth(base, now);
    expect(r.components).toEqual({ engagement: 100, billing: 100, utilisation: 100, support: 100 });
    expect(r.score).toBe(100);
  });

  it('is deterministic and within 0..100', () => {
    expect(computeHealth(base, now)).toEqual(computeHealth(base, now));
    const worst = computeHealth(
      {
        ...base,
        tenantStatus: 'CANCELLED',
        subscriptionStatus: 'CANCELED',
        paymentFailed: true,
        lastActiveAt: null,
        attendanceRecent: 0,
        maxUtilisation: 1.2,
        openTickets: 9,
      },
      now,
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThan(20);
  });

  it('weights: 40/30/15/15', () => {
    const r = computeHealth({ ...base, openTickets: 5 }, now); // support 20 -> 100 - 0.15*80 = 88
    expect(r.score).toBe(88);
  });

  it('billing: past due / grace / failed payment are low', () => {
    expect(
      computeHealth({ ...base, subscriptionStatus: 'PAST_DUE', tenantStatus: 'PAST_DUE' }, now)
        .components.billing,
    ).toBe(25);
    expect(computeHealth({ ...base, subscriptionStatus: 'GRACE' }, now).components.billing).toBe(
      10,
    );
    expect(computeHealth({ ...base, paymentFailed: true }, now).components.billing).toBe(60);
    expect(
      computeHealth(
        { ...base, tenantStatus: 'TRIAL', subscriptionStatus: 'TRIALING', trialEndsAt: ago(1) },
        now,
      ).components.billing,
    ).toBe(20);
  });

  it('engagement: recency steps and never-active grace for new tenants', () => {
    const e = (d: Date | null, created = ago(200)) =>
      computeHealth(
        { ...base, lastActiveAt: d, attendanceRecent: 0, members: 0, createdAt: created },
        now,
      ).components.engagement;
    expect(e(ago(0.5))).toBe(60); // 0.6*100 + 0.4*0
    expect(e(ago(10))).toBe(33); // 0.6*55
    expect(e(ago(60))).toBe(6);
    expect(e(null)).toBe(0);
    expect(e(null, ago(1))).toBe(30);
  });

  it('utilisation: >=90% / >=100% lower it; barely-used paid plan is low; trials neutral', () => {
    const u = (over: Partial<HealthInputs>) =>
      computeHealth({ ...base, ...over }, now).components.utilisation;
    expect(u({ maxUtilisation: 0.95 })).toBe(50);
    expect(u({ maxUtilisation: 1 })).toBe(30);
    expect(u({ membersUtilisation: 0.02, maxUtilisation: 0.02 })).toBe(30);
    expect(u({ membersUtilisation: 0.2, maxUtilisation: 0.2 })).toBe(75);
    expect(u({ paid: false, maxUtilisation: 0.01, membersUtilisation: 0.01 })).toBe(80);
  });

  it('support: open tickets', () => {
    const s = (n: number) => computeHealth({ ...base, openTickets: n }, now).components.support;
    expect([s(0), s(1), s(2), s(3), s(4), s(5)]).toEqual([100, 80, 60, 40, 40, 20]);
  });
});

describe('buckets', () => {
  it('maps 3 list buckets', () => {
    expect([0, 40, 41, 70, 71, 100].map(healthBucket)).toEqual([
      'at_risk',
      'at_risk',
      'fair',
      'fair',
      'healthy',
      'healthy',
    ]);
  });
  it('maps 5 distribution bands', () => {
    expect([0, 20, 21, 40, 41, 60, 61, 80, 81, 100].map(distributionBucket)).toEqual([
      '0-20',
      '0-20',
      '21-40',
      '21-40',
      '41-60',
      '41-60',
      '61-80',
      '61-80',
      '81-100',
      '81-100',
    ]);
    expect(healthDistribution([5, 5, 50, 99])).toEqual([
      { bucket: '0-20', count: 2 },
      { bucket: '21-40', count: 0 },
      { bucket: '41-60', count: 1 },
      { bucket: '61-80', count: 0 },
      { bucket: '81-100', count: 1 },
    ]);
  });
});
