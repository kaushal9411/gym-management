import { describe, expect, it } from 'vitest';

import { checkPasswordPolicy } from './password.service';

describe('checkPasswordPolicy', () => {
  it('accepts a password satisfying every rule', () => {
    const result = checkPasswordPolicy('Str0ng!Passw0rd');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = checkPasswordPolicy('Sh0rt!');
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('At least 8 characters');
  });

  it('rejects passwords missing an uppercase letter', () => {
    const result = checkPasswordPolicy('str0ng!password');
    expect(result.violations).toContain('At least one uppercase letter');
  });

  it('rejects passwords missing a number', () => {
    const result = checkPasswordPolicy('Strong!Password');
    expect(result.violations).toContain('At least one number');
  });

  it('rejects passwords missing a special character', () => {
    const result = checkPasswordPolicy('Str0ngPassword');
    expect(result.violations).toContain('At least one special character');
  });

  it('rejects common passwords even when structurally valid', () => {
    const result = checkPasswordPolicy('P@ssw0rd');
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('too common'))).toBe(true);
  });
});
