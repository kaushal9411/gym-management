import type { MemberInvoiceStatus } from '../../types';

export interface DueInfo {
  label: string;
  /** CSS colour token for the chip. */
  color: string;
}

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
};

/** "Due in N days" / "Overdue N days" derived client-side from `dueDate` + status; `null` for settled/cancelled invoices (nothing to chase). */
export function dueInfo(dueDate: string, status: MemberInvoiceStatus, now: Date = new Date()): DueInfo | null {
  if (status === 'PAID' || status === 'CANCELLED') return null;
  const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const diff = dayNumber(dueDate) - today;
  if (diff < 0) return { label: `Overdue ${-diff} day${diff === -1 ? '' : 's'}`, color: 'var(--destructive)' };
  if (diff === 0) return { label: 'Due today', color: 'var(--chart-4)' };
  return { label: `Due in ${diff} day${diff === 1 ? '' : 's'}`, color: diff <= 3 ? 'var(--chart-4)' : 'var(--muted-foreground)' };
}

/** Receivables-ageing ramp, green (current) → red (90+). */
export const AGING_COLORS: Record<string, string> = {
  Current: 'var(--chart-3)',
  '1-30': 'var(--chart-2)',
  '31-60': 'var(--chart-4)',
  '61-90': 'var(--chart-5)',
  '90+': 'var(--destructive)',
};
