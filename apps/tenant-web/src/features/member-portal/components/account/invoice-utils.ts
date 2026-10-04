import type { PortalTone } from '../kit';
import { localDateKey } from '../../lib/format';

/** MemberInvoiceStatus: UNPAID | PAID | PARTIALLY_PAID | OVERDUE | CANCELLED. */
export const INVOICE_STATUS: Record<string, { tone: PortalTone; label: string }> = {
  PAID: { tone: 'success', label: 'Paid' },
  UNPAID: { tone: 'warning', label: 'Unpaid' },
  PARTIALLY_PAID: { tone: 'info', label: 'Partly paid' },
  OVERDUE: { tone: 'danger', label: 'Overdue' },
  CANCELLED: { tone: 'muted', label: 'Cancelled' },
};

export const isOpenInvoice = (status: string) => status === 'UNPAID' || status === 'PARTIALLY_PAID' || status === 'OVERDUE';

/** Whole days from today to `dueDate` (negative = overdue). */
export function daysUntil(dueDate: string): number {
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date(`${localDateKey(new Date())}T00:00:00`).getTime();
  return Math.round((due - today) / 86_400_000);
}

/** Client-computed due chip for open invoices (null for settled ones). */
export function dueChip(status: string, dueDate: string): { tone: PortalTone; label: string } | null {
  if (!isOpenInvoice(status)) return null;
  const d = daysUntil(dueDate);
  if (d < 0 || status === 'OVERDUE') return { tone: 'danger', label: d < 0 ? `Overdue by ${-d} ${-d === 1 ? 'day' : 'days'}` : 'Overdue' };
  if (d === 0) return { tone: 'warning', label: 'Due today' };
  return { tone: d <= 3 ? 'warning' : 'info', label: `Due in ${d} ${d === 1 ? 'day' : 'days'}` };
}

export const PAYMENT_STATUS: Record<string, { tone: PortalTone; label: string }> = {
  SUCCESS: { tone: 'success', label: 'Paid' },
  PENDING: { tone: 'warning', label: 'Pending' },
  FAILED: { tone: 'danger', label: 'Failed' },
  CANCELLED: { tone: 'muted', label: 'Cancelled' },
  REFUNDED: { tone: 'violet', label: 'Refunded' },
  PARTIALLY_REFUNDED: { tone: 'violet', label: 'Part refunded' },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  ONLINE_GATEWAY: 'Online',
};
