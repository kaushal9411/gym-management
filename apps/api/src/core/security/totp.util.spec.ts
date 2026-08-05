import { generateSync } from 'otplib';
import { describe, expect, it } from 'vitest';

import { buildOtpAuthUri, generateBackupCodes, generateTotpSecret, normalizeBackupCode, verifyTotpCode } from './totp.util';

describe('generateTotpSecret', () => {
  it('generates a non-empty base32 secret, different each call', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a.length).toBeGreaterThan(10);
    expect(a).not.toBe(b);
  });
});

describe('buildOtpAuthUri', () => {
  it('builds an otpauth:// URI carrying the account label and FitCloud issuer', () => {
    const uri = buildOtpAuthUri('JBSWY3DPEHPK3PXP', 'owner@kaushalgym.example');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('FitCloud');
    expect(decodeURIComponent(uri)).toContain('owner@kaushalgym.example');
  });
});

describe('verifyTotpCode', () => {
  it('accepts the real current code for a secret', () => {
    const secret = generateTotpSecret();
    const code = generateSync({ secret });
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const secret = generateTotpSecret();
    const realCode = generateSync({ secret });
    const wrongCode = realCode === '000000' ? '111111' : '000000';
    expect(verifyTotpCode(secret, wrongCode)).toBe(false);
  });

  it('rejects a code generated for a DIFFERENT secret', () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const codeForB = generateSync({ secret: secretB });
    expect(verifyTotpCode(secretA, codeForB)).toBe(false);
  });

  it('never throws on garbage input, just returns false', () => {
    expect(verifyTotpCode('not-a-real-secret', 'abcdef')).toBe(false);
    expect(verifyTotpCode('', '')).toBe(false);
  });
});

describe('generateBackupCodes', () => {
  it('generates 10 unique codes in XXXX-XXXXXX shape by default', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{6}$/);
  });

  it('respects a custom count', () => {
    expect(generateBackupCodes(3)).toHaveLength(3);
  });
});

describe('normalizeBackupCode', () => {
  it('uppercases, trims, and strips dashes/whitespace so storage-time and entry-time hashes match', () => {
    expect(normalizeBackupCode(' xk2p-9qrt7m ')).toBe('XK2P9QRT7M');
    expect(normalizeBackupCode('XK2P9QRT7M')).toBe('XK2P9QRT7M');
    expect(normalizeBackupCode('xk2p 9qrt7m')).toBe('XK2P9QRT7M');
  });
});
