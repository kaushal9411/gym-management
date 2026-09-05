/**
 * Derives the real display symbol for an ISO currency code via `Intl`
 * (`₹` for INR, `£` for GBP, `CA$` for CAD, etc.) rather than a
 * hand-maintained code→symbol map. Used wherever a currency symbol needs to
 * be set/corrected to match a `currency` field that's actually chosen by
 * someone (onboarding's "Billing currency" step, and the one-off backfill
 * for tenants provisioned before that derivation existed) — deliberately
 * NOT used to silently override `TenantSettings.currencySymbol` on every
 * read, since a tenant can intentionally customize it away from the
 * Intl-derived default (e.g. "Fr" instead of "CHF" — see the schema
 * comment on that column).
 */
export function deriveCurrencySymbol(currencyCode: string): string {
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}
