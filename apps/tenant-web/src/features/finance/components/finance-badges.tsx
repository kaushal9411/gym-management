import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MemberInvoiceStatus, MemberPaymentMethod, MemberPaymentStatus } from '../types';

const PAYMENT_STATUS_STYLES: Record<MemberPaymentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  SUCCESS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  CANCELLED: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  REFUNDED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  PARTIALLY_REFUNDED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
};

const PAYMENT_STATUS_LABELS: Record<MemberPaymentStatus, string> = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
};

const INVOICE_STATUS_STYLES: Record<MemberInvoiceStatus, string> = {
  UNPAID: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  PARTIALLY_PAID: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  CANCELLED: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const METHOD_LABELS: Record<MemberPaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  ONLINE_GATEWAY: 'Online Gateway',
};

export function PaymentStatusBadge({ status }: { status: MemberPaymentStatus }) {
  return <Badge className={cn('border-transparent font-medium', PAYMENT_STATUS_STYLES[status])}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: MemberInvoiceStatus }) {
  return (
    <Badge className={cn('border-transparent font-medium', INVOICE_STATUS_STYLES[status])}>
      {status[0]}
      {status.slice(1).toLowerCase().replace('_', ' ')}
    </Badge>
  );
}

export function PaymentMethodBadge({ method }: { method: MemberPaymentMethod }) {
  return <Badge variant="secondary">{METHOD_LABELS[method]}</Badge>;
}
