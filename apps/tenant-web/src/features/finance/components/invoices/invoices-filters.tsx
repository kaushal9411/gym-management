'use client';

import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchBar } from '@/components/ui/search-bar';
import type { InvoiceListResponse, MemberInvoiceStatus } from '../../types';
import { INVOICE_STATUS_META } from '../finance-badges';
import { Chip, FieldLabel } from '../payments/payments-ui';

export interface InvoiceFilters {
  search: string;
  status: MemberInvoiceStatus | '';
  minAmount: string;
  maxAmount: string;
}

export const EMPTY_INVOICE_FILTERS: InvoiceFilters = { search: '', status: '', minAmount: '', maxAmount: '' };

const STATUS_CHIPS: { status: MemberInvoiceStatus; key: keyof NonNullable<InvoiceListResponse['counts']> }[] = [
  { status: 'UNPAID', key: 'unpaid' },
  { status: 'PARTIALLY_PAID', key: 'partiallyPaid' },
  { status: 'PAID', key: 'paid' },
  { status: 'OVERDUE', key: 'overdue' },
  { status: 'CANCELLED', key: 'cancelled' },
];

/** Search + date range (edits the period bar → `custom`) + amount range + status chips with server counts. No CSV/Excel: the invoice list has no export endpoint. */
export function InvoicesFilters({
  filters,
  onChange,
  dateFrom,
  dateTo,
  onDates,
  counts,
  onReset,
}: {
  filters: InvoiceFilters;
  onChange: (patch: Partial<InvoiceFilters>) => void;
  dateFrom: string;
  dateTo: string;
  onDates: (from: string, to: string) => void;
  counts: InvoiceListResponse['counts'];
  onReset: () => void;
}) {
  const fieldCls = 'h-10 rounded-xl';
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBar containerClassName="flex-[1_1_300px] w-auto" className="h-10 rounded-xl" placeholder="Search invoice number, member…" value={filters.search} onChange={(e) => onChange({ search: e.target.value })} />
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label="From date" className={`${fieldCls} w-[150px]`} value={dateFrom} max={dateTo || undefined} onChange={(e) => onDates(e.target.value, dateTo)} />
          <span className="text-muted-foreground">–</span>
          <Input type="date" aria-label="To date" className={`${fieldCls} w-[150px]`} value={dateTo} min={dateFrom || undefined} onChange={(e) => onDates(dateFrom, e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <Input type="number" min={0} inputMode="decimal" placeholder="Min amount" aria-label="Minimum amount" className={`${fieldCls} w-[110px]`} value={filters.minAmount} onChange={(e) => onChange({ minAmount: e.target.value })} />
          <span className="text-muted-foreground">–</span>
          <Input type="number" min={0} inputMode="decimal" placeholder="Max amount" aria-label="Maximum amount" className={`${fieldCls} w-[110px]`} value={filters.maxAmount} onChange={(e) => onChange({ maxAmount: e.target.value })} />
        </div>
        <Button variant="outline" className="h-10 rounded-xl font-bold" onClick={onReset}>
          <RotateCcw className="size-4" /> Reset
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <FieldLabel className="w-[62px]">Status</FieldLabel>
        <Chip active={filters.status === ''} onClick={() => onChange({ status: '' })}>
          All{counts ? ` ${counts.all}` : ''}
        </Chip>
        {STATUS_CHIPS.map(({ status, key }) => (
          <Chip key={status} active={filters.status === status} dotColor={INVOICE_STATUS_META[status].color} onClick={() => onChange({ status: filters.status === status ? '' : status })}>
            {INVOICE_STATUS_META[status].label}
            {counts ? ` ${counts[key]}` : ''}
          </Chip>
        ))}
      </div>
    </section>
  );
}
