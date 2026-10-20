import { describe, expect, it } from 'vitest';

import { smsInfo } from './sms-segments.util';

describe('smsInfo', () => {
  it('plain GSM text under 160 is one segment', () => {
    expect(smsInfo('Hello Aarav, your plan ends 26 Oct.')).toMatchObject({ segments: 1, encoding: 'GSM-7' });
  });
  it('161 GSM characters need two 153-char segments', () => {
    expect(smsInfo('a'.repeat(160)).segments).toBe(1);
    expect(smsInfo('a'.repeat(161))).toMatchObject({ segments: 2, characters: 161 });
    expect(smsInfo('a'.repeat(307)).segments).toBe(3);
  });
  it('extension characters count double', () => {
    expect(smsInfo('{'.repeat(80)).characters).toBe(160);
    expect(smsInfo('{'.repeat(81)).segments).toBe(2);
  });
  it('the rupee sign is not GSM-7, so the message switches to Unicode (70 / 67)', () => {
    const info = smsInfo('Pay ₹1500');
    expect(info.encoding).toBe('UNICODE');
    expect(smsInfo('₹'.repeat(70)).segments).toBe(1);
    expect(smsInfo('₹'.repeat(71)).segments).toBe(2);
  });
});
