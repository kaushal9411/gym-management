/**
 * Format-insensitive phone matching for the phone-number login flows (staff,
 * member, and the cross-gym "no gym picker" lookups).
 *
 * Phones are stored exactly as the gym typed them ("+91 98765 00000",
 * "98765-00000", "09876500000", …) while a person logging in types them
 * differently ("9876500000"), so an exact string compare never matches.
 *
 * Rule (India default, other countries kept sensible):
 *   - two numbers match when their digits-only forms are equal, OR
 *   - both are "Indian shaped" (10 digits; 0 + 10; 91 + 10; 0091 + 10) and end
 *     in the same 10 digits.
 * Anything else (e.g. a +1 or +44 number) only matches on identical digits, so
 * a foreign number can never collide with an Indian one that merely shares its
 * last 10 digits.
 */

const MIN_DIGITS = 7;

/** Digits only. */
export const phoneDigits = (phone: string): string => phone.replace(/\D/g, '');

/**
 * The 10-digit national number when `digits` is Indian shaped
 * (`XXXXXXXXXX`, `0XXXXXXXXXX`, `91XXXXXXXXXX`, `0091XXXXXXXXXX`), else null.
 */
export function indianNational10(digits: string): string | null {
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 14 && digits.startsWith('0091')) return digits.slice(4);
  return null;
}

/** True when the two phone numbers are the same number written differently. */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (da.length < MIN_DIGITS || db.length < MIN_DIGITS) return false;
  if (da === db) return true;
  const na = indianNational10(da);
  const nb = indianNational10(db);
  return na !== null && na === nb;
}

/**
 * Every plausible way the SAME number may have been stored verbatim (members'
 * phones are only trimmed before being blind-indexed, never reformatted), so a
 * lookup can hash each variant and use `phoneHash IN (...)`. Always includes
 * the trimmed typed value itself. Bounded (<= ~30 entries).
 */
export function phoneStorageVariants(typed: string): string[] {
  const raw = typed.trim();
  const out = new Set<string>([raw]);
  const digits = phoneDigits(raw);
  if (digits.length < MIN_DIGITS) return [...out];
  const n = indianNational10(digits);
  if (!n) {
    out.add(digits);
    out.add(`+${digits}`);
    return [...out];
  }
  const a = n.slice(0, 5);
  const b = n.slice(5);
  const bodies = [n, `${a} ${b}`, `${a}-${b}`];
  const prefixes = ['', '+91', '+91 ', '+91-', '91', '91 ', '91-', '0', '0091', '(+91) ', '(+91)'];
  for (const p of prefixes) for (const body of bodies) out.add(`${p}${body}`);
  return [...out];
}
