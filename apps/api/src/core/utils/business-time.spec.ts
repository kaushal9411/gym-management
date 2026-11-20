import { describe, expect, it } from 'vitest';

import { businessDate, businessDay } from './business-time';

describe('business time (India)', () => {
  it('uses the Indian calendar day, not the UTC one', () => {
    // 20:00 UTC on 19 Oct is already 01:30 on 20 Oct in India.
    expect(businessDate(new Date('2026-10-19T20:00:00Z'))).toBe('2026-10-20');
    expect(businessDate(new Date('2026-10-19T18:29:59Z'))).toBe('2026-10-19');
    expect(businessDate(new Date('2026-10-19T18:30:00Z'))).toBe('2026-10-20');
  });

  it('businessDay is the UTC-midnight Date of that Indian day, ready for DATE column comparisons', () => {
    expect(businessDay(new Date('2026-10-19T20:00:00Z')).toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });
});
