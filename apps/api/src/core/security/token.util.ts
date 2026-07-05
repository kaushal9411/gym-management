import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * Opaque, high-entropy tokens for refresh tokens / password resets / email
 * verification links. Only the SHA-256 hash is ever persisted — the plain
 * value exists only in the response/email and can't be recovered from the DB.
 */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cryptographically random numeric OTP, zero-padded to `length` digits. */
export function generateNumericOtp(length: number): string {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, '0');
}
