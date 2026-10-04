import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExpenseCategory, IncomeCategory, MemberInvoiceStatus, MemberPaymentMethod, MemberPaymentStatus } from '../types';

/** Status → label + theme token (chart slots keep the fixed categorical order; neutral for cancelled). */
export const PAYMENT_STATUS_META: Record<MemberPaymentStatus, { label: string; color: string }> = {
  SUCCESS: { label: 'Success', color: 'var(--chart-3)' },
  PENDING: { label: 'Pending', color: 'var(--chart-4)' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', color: 'var(--chart-5)' },
  REFUNDED: { label: 'Refunded', color: 'var(--chart-7)' },
  FAILED: { label: 'Failed', color: 'var(--chart-8)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--muted-foreground)' },
};

const INVOICE_STATUS_STYLES: Record<MemberInvoiceStatus, string> = {
  UNPAID: 'bg-warning/15 text-warning-foreground',
  PAID: 'bg-success/10 text-success',
  PARTIALLY_PAID: 'bg-muted text-muted-foreground',
  OVERDUE: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
};

export const PAYMENT_METHOD_COLORS: Record<MemberPaymentMethod, string> = {
  UPI: 'var(--chart-1)',
  CASH: 'var(--chart-2)',
  ONLINE_GATEWAY: 'var(--chart-3)',
  CREDIT_CARD: 'var(--chart-4)',
  BANK_TRANSFER: 'var(--chart-5)',
  DEBIT_CARD: 'var(--chart-6)',
  CHEQUE: 'var(--chart-7)',
};

export const METHOD_LABELS: Record<MemberPaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  ONLINE_GATEWAY: 'Online Gateway',
};

/** `tint` helper shared by status/method pills: soft token-tinted fill, text mixed toward the foreground for contrast in both themes. */
export function tokenPillStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
    color: `color-mix(in oklch, ${color} 62%, var(--foreground))`,
  };
}

export function PaymentStatusBadge({ status, className, onDark }: { status: MemberPaymentStatus; className?: string; /** White pill for use on the gradient hero. */ onDark?: boolean }) {
  const meta = PAYMENT_STATUS_META[status];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold', className)} style={onDark ? { ...tokenPillStyle(meta.color), backgroundColor: '#fff' } : tokenPillStyle(meta.color)}>
      <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

export const INVOICE_STATUS_META: Record<MemberInvoiceStatus, { label: string; color: string }> = {
  UNPAID: { label: 'Unpaid', color: 'var(--chart-4)' },
  PAID: { label: 'Paid', color: 'var(--chart-3)' },
  PARTIALLY_PAID: { label: 'Partially paid', color: 'var(--chart-4)' },
  OVERDUE: { label: 'Overdue', color: 'var(--destructive)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--muted-foreground)' },
};

export function InvoiceStatusBadge({ status, onDark, className }: { status: MemberInvoiceStatus; /** White token-tinted pill for the gradient hero. */ onDark?: boolean; className?: string }) {
  if (onDark) {
    const meta = INVOICE_STATUS_META[status];
    return (
      <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold', className)} style={{ ...tokenPillStyle(meta.color), backgroundColor: '#fff' }}>
        <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
        {meta.label}
      </span>
    );
  }
  return (
    <Badge className={cn('border-transparent font-medium', INVOICE_STATUS_STYLES[status])}>
      {status[0]}
      {status.slice(1).toLowerCase().replace('_', ' ')}
    </Badge>
  );
}

export function PaymentMethodBadge({ method }: { method: MemberPaymentMethod }) {
  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold" style={tokenPillStyle(PAYMENT_METHOD_COLORS[method])}>
      {METHOD_LABELS[method]}
    </span>
  );
}

/** Ledger category → label + chart token (fixed slots; OTHER is neutral). Shared by the donut, filter chips and table pills. */
export const INCOME_CATEGORY_META: Record<IncomeCategory, { label: string; color: string }> = {
  MEMBERSHIP_FEE: { label: 'Membership Fee', color: 'var(--chart-1)' },
  PERSONAL_TRAINING: { label: 'Personal Training', color: 'var(--chart-3)' },
  PRODUCT_SALES: { label: 'Product Sales', color: 'var(--chart-4)' },
  OTHER: { label: 'Other', color: 'var(--muted-foreground)' },
};

export const EXPENSE_CATEGORY_META: Record<ExpenseCategory, { label: string; color: string }> = {
  RENT: { label: 'Rent', color: 'var(--chart-1)' },
  SALARY: { label: 'Salary', color: 'var(--chart-7)' },
  UTILITIES: { label: 'Utilities', color: 'var(--chart-4)' },
  EQUIPMENT: { label: 'Equipment', color: 'var(--chart-5)' },
  MAINTENANCE: { label: 'Maintenance', color: 'var(--chart-2)' },
  MARKETING: { label: 'Marketing', color: 'var(--chart-3)' },
  OFFICE_SUPPLIES: { label: 'Office Supplies', color: 'var(--chart-6)' },
  OTHER: { label: 'Other', color: 'var(--muted-foreground)' },
};

export type CategoryMeta = Record<string, { label: string; color: string }>;

export function CategoryBadge({ category, meta }: { category: string; meta: CategoryMeta }) {
  const m = meta[category] ?? { label: category, color: 'var(--muted-foreground)' };
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold" style={tokenPillStyle(m.color)}>
      <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}
