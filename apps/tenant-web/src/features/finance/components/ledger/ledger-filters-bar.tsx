'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchBar } from '@/components/ui/search-bar';
import type { LedgerAnalytics } from '../../types';
import type { CategoryMeta } from '../finance-badges';
import { Chip, FieldLabel } from '../payments/payments-ui';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDates: (from: string, to: string) => void;
  categoryMeta: CategoryMeta;
  category: string;
  onCategory: (c: string) => void;
  /** Counts per category chip; omitted (chips show no number) when analytics is unavailable. */
  counts: LedgerAnalytics['categories'] | undefined;
  onReset: () => void;
}

/**
 * Search + date range + category chips. The list API has no amount-range params, so (unlike Payments) there is no min/max amount field.
 */
export function LedgerFiltersBar({ search, onSearch, dateFrom, dateTo, onDates, categoryMeta, category, onCategory, counts, onReset }: Props) {
  const byCat = new Map((counts ?? []).map((c) => [c.category, c.count]));
  const total = counts ? counts.reduce((s, c) => s + c.count, 0) : null;
  const fieldCls = 'h-10 rounded-xl';
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBar containerClassName="flex-[1_1_300px] w-auto" className="h-10 rounded-xl" placeholder="Search description…" value={search} onChange={(e) => onSearch(e.target.value)} />
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label="From date" className={`${fieldCls} w-[150px]`} value={dateFrom} max={dateTo || undefined} onChange={(e) => onDates(e.target.value, dateTo)} />
          <span className="text-muted-foreground">–</span>
          <Input type="date" aria-label="To date" className={`${fieldCls} w-[150px]`} value={dateTo} min={dateFrom || undefined} onChange={(e) => onDates(dateFrom, e.target.value)} />
        </div>
        <Button variant="outline" className="h-10 rounded-xl font-bold" onClick={onReset}>
          <RotateCcw className="size-4" /> Reset
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <FieldLabel className="w-[72px]">Category</FieldLabel>
        <Chip active={category === ''} onClick={() => onCategory('')}>
          All{total !== null ? ` ${total}` : ''}
        </Chip>
        {Object.entries(categoryMeta).map(([key, m]) => (
          <Chip key={key} active={category === key} dotColor={m.color} onClick={() => onCategory(category === key ? '' : key)}>
            {m.label}
            {counts ? ` ${byCat.get(key) ?? 0}` : ''}
          </Chip>
        ))}
      </div>
    </section>
  );
}
