import { describe, expect, it } from 'vitest';

import { computeQuota, describeShortChannels, disabledChannels, shortChannels } from './quota.util';

const base = { channel: 'SMS' as const, enabled: true, disabledReason: null };

describe('computeQuota', () => {
  it('unlimited channels are never over', () => {
    expect(computeQuota({ ...base, limit: null, used: 999_999, wouldUse: 10_000 })).toMatchObject({ remaining: null, over: false, shortBy: 0 });
  });
  it('fits exactly: wouldUse == remaining is allowed', () => {
    expect(computeQuota({ ...base, limit: 1000, used: 760, wouldUse: 240 })).toMatchObject({ remaining: 240, over: false, shortBy: 0 });
  });
  it('one over is short by one', () => {
    expect(computeQuota({ ...base, limit: 1000, used: 760, wouldUse: 241 })).toMatchObject({ remaining: 240, over: true, shortBy: 1 });
  });
  it('quota already exhausted or overshot by earlier sends clamps remaining at 0', () => {
    expect(computeQuota({ ...base, limit: 100, used: 130, wouldUse: 5 })).toMatchObject({ remaining: 0, over: true, shortBy: 5 });
  });
  it('wouldUse 0 never counts as over', () => {
    expect(computeQuota({ ...base, limit: 100, used: 100, wouldUse: 0 }).over).toBe(false);
  });
});

describe('short / disabled channel collection', () => {
  const rows = [
    { channel: 'SMS' as const, quota: computeQuota({ ...base, limit: 100, used: 90, wouldUse: 412 }) },
    { channel: 'EMAIL' as const, quota: computeQuota({ ...base, channel: 'EMAIL', limit: 5000, used: 1210, wouldUse: 412 }) },
    { channel: 'WHATSAPP' as const, quota: computeQuota({ channel: 'WHATSAPP', enabled: false, disabledReason: 'disabled_platform', limit: null, used: 0, wouldUse: 30 }) },
    { channel: 'PUSH' as const, quota: computeQuota({ channel: 'PUSH', enabled: true, disabledReason: null, limit: null, used: 0, wouldUse: 412 }) },
  ];
  it('lists only enabled channels that run out, with the shortfall', () => {
    expect(shortChannels(rows)).toEqual([{ channel: 'SMS', remaining: 10, wouldUse: 412, shortBy: 402 }]);
  });
  it('lists disabled channels that would have sent something', () => {
    expect(disabledChannels(rows)).toEqual([{ channel: 'WHATSAPP', reason: 'disabled_platform' }]);
  });
  it('describes the shortfall in one readable sentence', () => {
    const text = describeShortChannels(shortChannels(rows));
    expect(text).toContain('SMS: 10 left');
    expect(text).toContain('412');
    expect(text).toContain('short by 402');
  });
});
