/**
 * Server-side port of tenant-web's existing `wa.me`/`tel:` link convention
 * (`features/members/components/detail/member-hero.tsx`,
 * `.../list/member-card.tsx`) — prepends India's country code only when the
 * stored number looks like a bare 10-digit local number, leaves anything
 * else untouched rather than guessing. Twilio requires E.164 (`+` prefix),
 * which those two frontend call sites never needed (`wa.me`/`tel:` links
 * don't).
 */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `+${withCountryCode}`;
}
