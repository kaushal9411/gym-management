import { randomInt } from 'node:crypto';

import { generateSecret, generateURI, verifySync } from 'otplib';

/**
 * `otplib@13` is a big API break from the classic v11/v12
 * `authenticator.{generateSecret,keyuri,verify}` singleton shape — it's now
 * a set of standalone functions, most of them async-first (`generate`,
 * `verify`) with separate `*Sync` variants (`generateSync`, `verifySync`)
 * used here instead, since nothing else in this module needs to be async
 * and every call site (`AuthService`) is already inside an async function
 * regardless. `generateSecret`/`generateURI` are plain synchronous
 * functions despite having no `Sync` suffix — confirmed via the installed
 * package, not assumed from memory of the older API.
 */

/** "FitCloud" — shown in the authenticator app under each entry, alongside the account label. */
const ISSUER = 'FitCloud';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids transcription ambiguity

export function generateTotpSecret(): string {
  return generateSecret();
}

/** `otpauth://` URI an authenticator app (Google Authenticator, Authy, 1Password, …) scans to add the account. */
export function buildOtpAuthUri(secret: string, accountLabel: string): string {
  return generateURI({ issuer: ISSUER, label: accountLabel, secret });
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return verifySync({ secret, token: code }).valid;
  } catch {
    return false; // malformed secret/code — never throw out of a verification check
  }
}

/** Human-typeable one-time recovery codes (e.g. `XK2P-9QRT7M`) — generated once at setup confirmation, shown exactly once, hashed before storage like every other credential in this codebase. */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = Array.from({ length: 10 }, () => BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)]).join('');
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

/** Backup codes are user-typed — normalize case/whitespace/dashes before hashing so storage-time and verify-time hashes actually match regardless of how the user entered it. */
export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
