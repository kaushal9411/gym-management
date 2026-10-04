import { randomInt } from 'node:crypto';

export interface CouponShape {
  type?: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TRIAL_EXTENSION';
  percentOff?: number | null;
  amountOff?: number | null;
  currency?: string | null;
  trialExtensionDays?: number | null;
}

export interface ShapeIssue {
  path: string;
  message: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);

/** Cross-field rules shared by create, bulk-generate and the merged state of an update. */
export function couponShapeIssues(c: CouponShape): ShapeIssue[] {
  const issues: ShapeIssue[] = [];
  if (
    c.type === 'PERCENTAGE' &&
    !(isNum(c.percentOff) && c.percentOff >= 1 && c.percentOff <= 100)
  ) {
    issues.push({
      path: 'percentOff',
      message: 'percentOff must be between 1 and 100 for a percentage coupon',
    });
  }
  if (c.type === 'FIXED_AMOUNT') {
    if (!(isNum(c.amountOff) && c.amountOff > 0))
      issues.push({
        path: 'amountOff',
        message: 'amountOff must be greater than 0 for a fixed-amount coupon',
      });
    if (!c.currency)
      issues.push({ path: 'currency', message: 'currency is required for a fixed-amount coupon' });
  }
  if (c.type === 'TRIAL_EXTENSION' && !(isNum(c.trialExtensionDays) && c.trialExtensionDays > 0)) {
    issues.push({
      path: 'trialExtensionDays',
      message: 'trialExtensionDays must be greater than 0 for a trial-extension coupon',
    });
  }
  return issues;
}

/** No ambiguous characters: I, O, 0, 1 removed. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomSuffix(
  length: number,
  pick: (max: number) => number = (max) => randomInt(max),
): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[pick(CODE_ALPHABET.length)]!;
  return out;
}

/**
 * Generates `count` distinct codes `<prefix><random suffix>` that are not in `existing`.
 * Returns null if it could not (keyspace too small / unlucky) so the caller can 422.
 */
export function generateUniqueCodes(
  prefix: string,
  count: number,
  length: number,
  existing: ReadonlySet<string> = new Set(),
  pick?: (max: number) => number,
): string[] | null {
  const codes = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 50 + 100;
  while (codes.size < count && attempts < maxAttempts) {
    attempts += 1;
    const code = `${prefix}${randomSuffix(length, pick)}`;
    if (!existing.has(code)) codes.add(code);
  }
  return codes.size === count ? [...codes] : null;
}
