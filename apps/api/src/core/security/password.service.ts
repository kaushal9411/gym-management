import bcrypt from 'bcryptjs';

import { env } from '../../config/env';
import { ValidationError } from '../errors/app-error';

import { isCommonPassword } from './common-passwords';

const MIN_LENGTH = 8;

export interface PasswordPolicyResult {
  valid: boolean;
  violations: string[];
}

/**
 * Structural policy check — mirrors the frontend's strongPasswordSchema
 * exactly (8+ chars, upper, lower, number, special) plus a common-password
 * denylist the client can't enforce authoritatively.
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const violations: string[] = [];
  if (password.length < MIN_LENGTH) violations.push(`At least ${MIN_LENGTH} characters`);
  if (!/[A-Z]/.test(password)) violations.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) violations.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) violations.push('At least one number');
  if (!/[^A-Za-z0-9]/.test(password)) violations.push('At least one special character');
  if (isCommonPassword(password)) violations.push('This password is too common — choose something less predictable');

  return { valid: violations.length === 0, violations };
}

export function assertPasswordPolicy(password: string): void {
  const result = checkPasswordPolicy(password);
  if (!result.valid) {
    throw new ValidationError('Password does not meet the security policy', { violations: result.violations });
  }
}

/**
 * bcrypt hashing (bcryptjs — pure-JS, no native build step; functionally
 * equivalent to `bcrypt` and drop-in compatible with its hash format).
 * Password history is intentionally NOT implemented yet — future-ready
 * only, per scope — but the hash format here is what a history table
 * would store verbatim.
 */
export class PasswordService {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.security.bcryptSaltRounds);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

export const passwordService = new PasswordService();
