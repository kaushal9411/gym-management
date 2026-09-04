/**
 * A staff email always contains "@"; a Member ID (e.g. "MEM-0007") never
 * does — the one signal needed to route a shared identifier field to the
 * right of two cryptographically distinct auth planes (staff JWT audience
 * vs member JWT audience). Shared between the unified login form and the
 * unified forgot-password form — both accept one "Email or Member ID"
 * field and branch on this, rather than making the user pick a role or
 * maintaining two separate screens.
 */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes('@');
}
