import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MemberInvoiceStatus, MemberPaymentMethod, MemberPaymentStatus } from '../types';

const PAYMENT_STATUS_STYLES: Record<MemberPaymentStatus, string> = {
  PENDING: 'bg-warning/15 text-warning-foreground',
  SUCCESS: 'bg-success/10 text-success',
  FAILED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
  REFUNDED: 'bg-muted text-muted-foreground',
  PARTIALLY_REFUNDED: 'bg-muted text-muted-foreground',
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
  UNPAID: 'bg-warning/15 text-warning-foreground',
  PAID: 'bg-success/10 text-success',
  PARTIALLY_PAID: 'bg-muted text-muted-foreground',
  OVERDUE: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
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
