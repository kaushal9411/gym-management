'use client';

import * as React from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchBar } from '@/components/ui/search-bar';
import { Select } from '@/components/ui/select';
import { useMembershipPlanList } from '@/features/members/hooks/use-members';
import type { MemberPaymentMethod, MemberPaymentStatus, PaymentAnalytics } from '../../types';
import { METHOD_LABELS, PAYMENT_STATUS_META } from '../finance-badges';
import { Chip, FieldLabel } from './payments-ui';

export interface PaymentFilters {
  search: string;
  status: MemberPaymentStatus | '';
  method: MemberPaymentMethod | '';
  planId: string;
  minAmount: string;
  maxAmount: string;
}

export const EMPTY_FILTERS: PaymentFilters = { search: '', status: '', method: '', planId: '', minAmount: '', maxAmount: '' };

const STATUS_CHIPS: MemberPaymentStatus[] = ['SUCCESS', 'PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'CANCELLED'];
const METHOD_CHIPS = Object.keys(METHOD_LABELS) as MemberPaymentMethod[];

interface FiltersBarProps {
  filters: PaymentFilters;
  onChange: (patch: Partial<PaymentFilters>) => void;
  dateFrom: string;
  dateTo: string;
  onDates: (from: string, to: string) => void;
  statuses: PaymentAnalytics['statuses'] | undefined;
  branchId: string;
  onReset: () => void;
  onCsv: () => void;
  onExcel: () => void;
}

export function FiltersBar({ filters, onChange, dateFrom, dateTo, onDates, statuses, branchId, onReset, onCsv, onExcel }: FiltersBarProps) {
  const plans = useMembershipPlanList({ page: 1, limit: 100, branchId: branchId || undefined, sortBy: 'name', sortDir: 'asc' });
  const counts = new Map((statuses ?? []).map((s) => [s.status, s.count]));
  const totalCount = statuses ? statuses.reduce((s, x) => s + x.count, 0) : null;
  const fieldCls = 'h-10 rounded-xl';

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBar
          containerClassName="flex-[1_1_300px] w-auto"
          className="h-10 rounded-xl"
          placeholder="Search payment no., member, reference…"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label="From date" className={`${fieldCls} w-[150px]`} value={dateFrom} max={dateTo || undefined} onChange={(e) => onDates(e.target.value, dateTo)} />
          <span className="text-muted-foreground">–</span>
          <Input type="date" aria-label="To date" className={`${fieldCls} w-[150px]`} value={dateTo} min={dateFrom || undefined} onChange={(e) => onDates(dateFrom, e.target.value)} />
        </div>
        <div className="min-w-[150px]">
          <Select aria-label="Filter by plan" className={fieldCls} value={filters.planId} onChange={(e) => onChange({ planId: e.target.value })}>
            <option value="">All plans</option>
            {(plans.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <Input type="number" min={0} inputMode="decimal" placeholder="Min ₹" aria-label="Minimum amount" className={`${fieldCls} w-[96px]`} value={filters.minAmount} onChange={(e) => onChange({ minAmount: e.target.value })} />
          <span className="text-muted-foreground">–</span>
          <Input type="number" min={0} inputMode="decimal" placeholder="Max ₹" aria-label="Maximum amount" className={`${fieldCls} w-[96px]`} value={filters.maxAmount} onChange={(e) => onChange({ maxAmount: e.target.value })} />
        </div>
        <Button variant="outline" className="h-10 rounded-xl font-bold" onClick={onReset}>
          <RotateCcw className="size-4" /> Reset
        </Button>
        <Button variant="outline" className="h-10 rounded-xl font-bold" onClick={onCsv}>
          <Upload className="size-4" /> CSV
        </Button>
        <Button variant="outline" className="h-10 rounded-xl font-bold" onClick={onExcel}>
          <Download className="size-4" /> Excel
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <FieldLabel className="w-[62px]">Status</FieldLabel>
        <Chip active={filters.status === ''} onClick={() => onChange({ status: '' })}>
          All{totalCount !== null ? ` ${totalCount}` : ''}
        </Chip>
        {STATUS_CHIPS.map((s) => (
          <Chip key={s} active={filters.status === s} dotColor={PAYMENT_STATUS_META[s].color} onClick={() => onChange({ status: filters.status === s ? '' : s })}>
            {PAYMENT_STATUS_META[s].label}
            {statuses ? ` ${counts.get(s) ?? 0}` : ''}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <FieldLabel className="w-[62px]">Method</FieldLabel>
        <Chip active={filters.method === ''} onClick={() => onChange({ method: '' })}>
          All
        </Chip>
        {METHOD_CHIPS.map((m) => (
          <Chip key={m} active={filters.method === m} onClick={() => onChange({ method: filters.method === m ? '' : m })}>
            {METHOD_LABELS[m]}
          </Chip>
        ))}
      </div>
    </section>
  );
}
