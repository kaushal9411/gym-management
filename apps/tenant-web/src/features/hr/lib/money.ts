/** INR formatting with Indian digit grouping (₹1,25,000.50). Accepts Prisma-style decimal strings. */
export function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function inr(v: string | number | null | undefined, symbol = '₹'): string {
  const n = toNumber(v);
  const whole = Number.isInteger(n);
  return `${n < 0 ? '-' : ''}${symbol}${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function compactInr(v: string | number | null | undefined, symbol = '₹'): string {
  const n = toNumber(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10_000_000) return `${sign}${symbol}${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${sign}${symbol}${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}${symbol}${Math.round(abs)}`;
}
