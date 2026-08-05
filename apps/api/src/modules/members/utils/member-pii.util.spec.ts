import { describe, expect, it } from 'vitest';

import {
  decryptMemberContact,
  decryptMemberField,
  encryptEmail,
  encryptPhone,
  hashEmail,
  hashPhone,
  normalizeEmail,
  normalizePhone,
} from './member-pii.util';

describe('encryptEmail / decryptMemberField', () => {
  it('round-trips a normalized value, and ciphertext differs from the plaintext', () => {
    const ciphertext = encryptEmail('Jane.Doe@Example.com');
    expect(ciphertext).not.toBe('jane.doe@example.com');
    expect(decryptMemberField(ciphertext)).toBe('jane.doe@example.com');
  });

  it('produces a different ciphertext each call (random IV) for the same plaintext', () => {
    const a = encryptEmail('same@example.com');
    const b = encryptEmail('same@example.com');
    expect(a).not.toBe(b);
    expect(decryptMemberField(a)).toBe(decryptMemberField(b));
  });
});

describe('encryptPhone / decryptMemberField', () => {
  it('round-trips a trimmed value', () => {
    const ciphertext = encryptPhone('  +91 98765 43210  ');
    expect(decryptMemberField(ciphertext)).toBe('+91 98765 43210');
  });
});

describe('hashEmail / hashPhone', () => {
  it('is deterministic — same input always hashes the same, unlike encryption', () => {
    expect(hashEmail('Jane.Doe@Example.com')).toBe(hashEmail('jane.doe@example.com '));
    expect(hashPhone(' 9876543210')).toBe(hashPhone('9876543210 '));
  });

  it('produces different hashes for different values', () => {
    expect(hashEmail('a@example.com')).not.toBe(hashEmail('b@example.com'));
  });

  it('is a 64-char hex string (SHA-256)', () => {
    expect(hashEmail('a@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('normalizeEmail / normalizePhone', () => {
  it('lowercases and trims email, only trims phone', () => {
    expect(normalizeEmail(' Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(normalizePhone(' +1 555 0100 ')).toBe('+1 555 0100');
  });
});

describe('decryptMemberContact', () => {
  it('decrypts email/phone on a row, leaving null fields untouched', () => {
    const row = { id: 'm1', email: encryptEmail('a@example.com'), phone: null as string | null };
    const decrypted = decryptMemberContact(row);
    expect(decrypted.email).toBe('a@example.com');
    expect(decrypted.phone).toBeNull();
    expect(decrypted.id).toBe('m1');
  });
});
