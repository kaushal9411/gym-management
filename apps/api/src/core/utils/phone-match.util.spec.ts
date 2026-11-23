import { describe, expect, it } from 'vitest';

import { indianNational10, phoneDigits, phonesMatch, phoneStorageVariants } from './phone-match.util';

describe('phoneDigits / indianNational10', () => {
  it('keeps digits only', () => expect(phoneDigits('+91 (98765)-00000')).toBe('919876500000'));
  it('recognises Indian shapes', () => {
    expect(indianNational10('9876500000')).toBe('9876500000');
    expect(indianNational10('09876500000')).toBe('9876500000');
    expect(indianNational10('919876500000')).toBe('9876500000');
    expect(indianNational10('00919876500000')).toBe('9876500000');
  });
  it('rejects anything else', () => {
    expect(indianNational10('14155550123')).toBeNull(); // 11 digits, not 0-prefixed
    expect(indianNational10('447911123456')).toBeNull();
    expect(indianNational10('98765')).toBeNull();
  });
});

describe('phonesMatch', () => {
  it.each([
    ['+91 98765 00000', '9876500000'],
    ['9876500000', '+91-98765-00000'],
    ['09876500000', '919876500000'],
    ['0091 9876500000', '98765 00000'],
    ['(+91) 98765 00000', '9876500000'],
  ])('%s == %s', (a, b) => {
    expect(phonesMatch(a, b)).toBe(true);
    expect(phonesMatch(b, a)).toBe(true);
  });

  it.each([
    ['+91 98765 00000', '9876500001'],
    ['+91 98765 00000', '98765 0000'],
    ['+44 7911 123456', '7911123456'], // foreign vs Indian-shaped with the same trailing 10
    ['+1 415 555 0123', '4155550123'],
    ['12345', '12345'], // too short to trust
    ['', '9876500000'],
    [null, '9876500000'],
  ])('%s != %s', (a, b) => expect(phonesMatch(a, b)).toBe(false));

  it('identical non-Indian numbers match regardless of formatting', () => {
    expect(phonesMatch('+44 7911 123456', '+447911123456')).toBe(true);
    expect(phonesMatch('+1 (415) 555-0123', '14155550123')).toBe(true);
  });
});

describe('phoneStorageVariants', () => {
  it('always contains the trimmed typed value and the common stored shapes of an Indian number', () => {
    const v = phoneStorageVariants(' 9876500000 ');
    for (const stored of ['9876500000', '+919876500000', '919876500000', '09876500000', '+91 9876500000', '+91-9876500000', '+91 98765 00000', '98765 00000', '98765-00000']) {
      expect(v).toContain(stored);
    }
    expect(v.length).toBeLessThan(40);
  });

  it('is the same set whichever way the Indian number is typed', () => {
    const a = new Set(phoneStorageVariants('+91 98765 00000'));
    for (const typed of ['9876500000', '09876500000', '919876500000']) {
      const b = new Set(phoneStorageVariants(typed));
      for (const x of b) if (x !== typed.trim()) expect(a.has(x)).toBe(true);
    }
  });

  it('keeps foreign numbers narrow (digits / +digits only)', () => {
    expect(phoneStorageVariants('+44 7911 123456').sort()).toEqual(['+44 7911 123456', '+447911123456', '447911123456'].sort());
  });

  it('does not expand numbers that are too short', () => {
    expect(phoneStorageVariants('12345')).toEqual(['12345']);
  });
});
