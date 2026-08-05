import { blindIndex } from '../../../core/security/blind-index.util';
import { decryptSecret, encryptSecret } from '../../../core/security/encryption.util';

/**
 * Field-level encryption for `Member.email`/`Member.phone` (audit
 * remediation, Medium-priority). Both are AES-256-GCM ciphertext at rest
 * (`core/security/encryption.util.ts`, the same scheme already used for
 * `TenantAiSettings.apiKeyEncrypted`/`User.mfaSecret`) with a parallel
 * `emailHash`/`phoneHash` blind-index column for exact-match lookups —
 * `MemberRepository#findByEmail`/`findByPhone` and the create/update
 * uniqueness checks all go through the hash, not the ciphertext.
 *
 * Trade-off (confirmed with the user before building this): the member-list
 * free-text search no longer substring-matches email/phone — only an EXACT
 * email/phone finds a match via the hash; ciphertext can't be `contains`-
 * filtered in SQL. Name/Member ID search is unaffected.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.trim();
}

export function hashEmail(email: string): string {
  return blindIndex(normalizeEmail(email));
}

export function hashPhone(phone: string): string {
  return blindIndex(normalizePhone(phone));
}

export function encryptEmail(email: string): string {
  return encryptSecret(normalizeEmail(email));
}

export function encryptPhone(phone: string): string {
  return encryptSecret(normalizePhone(phone));
}

export function decryptMemberField(ciphertext: string): string {
  return decryptSecret(ciphertext);
}

/** Apply to every `Member` row read OUTSIDE `MemberRepository`'s own funnel (relational `include: { member: true }` on another model, or a raw `db.member.findFirst`) before touching `.email`/`.phone`. */
export function decryptMemberContact<T extends { email: string | null; phone: string | null }>(row: T): T {
  return {
    ...row,
    email: row.email ? decryptMemberField(row.email) : row.email,
    phone: row.phone ? decryptMemberField(row.phone) : row.phone,
  };
}

export function decryptMemberContactMany<T extends { email: string | null; phone: string | null }>(rows: T[]): T[] {
  return rows.map(decryptMemberContact);
}

/** Null-safe wrapper for `db.member.findFirst`-style call sites outside `MemberRepository` — chain directly around the query result. */
export function decryptMemberContactNullable<T extends { email: string | null; phone: string | null }>(row: T | null): T | null {
  return row ? decryptMemberContact(row) : null;
}
