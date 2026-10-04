/** Pure coupon helpers (status derivation, usage, daily buckets). Unit-tested in coupon-status.util.spec.ts. */

export type CouponStatus = 'active' | 'disabled' | 'expired' | 'exhausted' | 'scheduled';

export interface CouponStatusInput {
  isActive: boolean;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  /** The enforced counter (`Coupon.timesRedeemed`) — it is what `/coupon/validate` checks against `maxRedemptions`. */
  timesRedeemed: number;
  /** No start date exists in the schema today, so this is always null from the API; kept so the state machine is complete. */
  startsAt?: Date | null;
}

/** Precedence: disabled > expired > exhausted > scheduled > active. */
export function deriveCouponStatus(c: CouponStatusInput, now: Date = new Date()): CouponStatus {
  if (!c.isActive) return 'disabled';
  if (c.expiresAt && c.expiresAt.getTime() < now.getTime()) return 'expired';
  if (c.maxRedemptions !== null && c.timesRedeemed >= c.maxRedemptions) return 'exhausted';
  if (c.startsAt && c.startsAt.getTime() > now.getTime()) return 'scheduled';
  return 'active';
}

export function remainingRedemptions(
  maxRedemptions: number | null,
  timesRedeemed: number,
): number | null {
  return maxRedemptions === null ? null : Math.max(maxRedemptions - timesRedeemed, 0);
}

/** 0..100 (1 dp, capped); null for unlimited coupons. */
export function usagePct(maxRedemptions: number | null, timesRedeemed: number): number | null {
  if (maxRedemptions === null || maxRedemptions <= 0) return null;
  return Math.min(100, Math.round((timesRedeemed / maxRedemptions) * 1000) / 10);
}

export interface CouponComputed {
  status: CouponStatus;
  redemptions: number;
  remaining: number | null;
  usagePct: number | null;
  discountGiven: string;
  lastRedeemedAt: Date | null;
}

export function buildComputed(
  c: CouponStatusInput,
  facts: { redemptions: number; discountGiven: number; lastRedeemedAt: Date | null },
  now: Date = new Date(),
): CouponComputed {
  return {
    status: deriveCouponStatus(c, now),
    redemptions: facts.redemptions,
    remaining: remainingRedemptions(c.maxRedemptions, c.timesRedeemed),
    usagePct: usagePct(c.maxRedemptions, c.timesRedeemed),
    discountGiven: facts.discountGiven.toFixed(2),
    lastRedeemedAt: facts.lastRedeemedAt,
  };
}

const DAY_MS = 86_400_000;
const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * 30 UTC days ending today, zero-filled; `previousCount` is the count `days` days earlier
 * (the immediately preceding window, same offset). `dates` = redemption timestamps over the last 2*days days.
 */
export function dailySeries(
  dates: Date[],
  now: Date,
  days = 30,
): Array<{ date: string; count: number; previousCount: number }> {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(utcDay(d), (counts.get(utcDay(d)) ?? 0) + 1);
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: Array<{ date: string; count: number; previousCount: number }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = utcDay(new Date(todayMs - i * DAY_MS));
    const prev = utcDay(new Date(todayMs - (i + days) * DAY_MS));
    out.push({ date: day, count: counts.get(day) ?? 0, previousCount: counts.get(prev) ?? 0 });
  }
  return out;
}
