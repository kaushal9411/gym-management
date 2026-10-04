import type { MemberInvoiceDetail } from '../../types';

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Payment statuses that count as money actually received against the invoice. */
const RECEIVED = new Set(['SUCCESS', 'PARTIALLY_REFUNDED']);
// Note: the DTO's payments[] only has `finalAmount` (no refunded amount), so a PARTIALLY_REFUNDED
// payment is counted at its full final amount — an honest upper bound, not a net figure.

export interface InvoiceMath {
  total: number;
  paid: number;
  paidCount: number;
  /** Outstanding amount; 0 when PAID; `null` when CANCELLED (nothing is collectable). */
  balance: number | null;
  /** 0–100, integer. */
  paidPct: number;
  balancePct: number;
  /** Whole days from invoiceDate to dueDate. */
  termsDays: number;
  /** Whole days from today to dueDate (negative = overdue). */
  daysToDue: number;
  settled: boolean;
  cancelled: boolean;
}

/** Parse a `YYYY-MM-DD` (or ISO) date as a UTC-midnight day number so day diffs ignore timezone/DST. */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

function localToday(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
}

export function computeInvoiceMath(invoice: Pick<MemberInvoiceDetail, 'totalAmount' | 'status' | 'payments' | 'invoiceDate' | 'dueDate'>, now: Date = new Date()): InvoiceMath {
  const total = num(invoice.totalAmount);
  const received = invoice.payments.filter((p) => RECEIVED.has(p.status));
  const cancelled = invoice.status === 'CANCELLED';
  const settled = invoice.status === 'PAID';
  // A PAID invoice is fully collected even if its payment rows are missing/partial in the DTO.
  const paid = settled ? Math.max(received.reduce((s, p) => s + num(p.finalAmount), 0), total) : received.reduce((s, p) => s + num(p.finalAmount), 0);
  const balance = cancelled ? null : settled ? 0 : Math.max(total - paid, 0);
  const pct = (n: number) => (total > 0 ? Math.min(Math.max(Math.round((n / total) * 100), 0), 100) : 0);
  const paidPct = settled ? 100 : pct(paid);
  return {
    total,
    paid,
    paidCount: received.length,
    balance,
    paidPct,
    balancePct: balance === null || balance <= 0 ? 0 : 100 - paidPct,
    termsDays: Math.max(dayNumber(invoice.dueDate) - dayNumber(invoice.invoiceDate), 0),
    daysToDue: dayNumber(invoice.dueDate) - localToday(now),
    settled: settled || (!cancelled && total > 0 && balance === 0),
    cancelled,
  };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** "settled" / "cancelled" / "due today" / "due in N days" / "overdue by N days". */
export function dueLabel(m: InvoiceMath): { text: string; tone: 'ok' | 'warn' | 'bad' | 'muted' } {
  if (m.cancelled) return { text: 'cancelled', tone: 'muted' };
  if (m.settled) return { text: 'settled', tone: 'ok' };
  if (m.daysToDue < 0) return { text: `overdue by ${plural(-m.daysToDue, 'day')}`, tone: 'bad' };
  if (m.daysToDue === 0) return { text: 'due today', tone: 'warn' };
  return { text: `due in ${plural(m.daysToDue, 'day')}`, tone: 'warn' };
}
