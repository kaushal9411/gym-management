'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { LedgerListResponse } from '../../types';
import { num } from '../payments/payments-ui';
import type { LedgerSort } from './use-ledger-controls';

export function SortHeader({ label, column, sortBy, sortDir, onSort, right }: { label: string; column: LedgerSort; sortBy: LedgerSort; sortDir: 'asc' | 'desc'; onSort: (c: LedgerSort) => void; right?: boolean }) {
  const icon = sortBy !== column ? <ArrowUpDown className="size-3.5 opacity-60" /> : sortDir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  return (
    <button type="button" className={`flex items-center gap-1 font-medium hover:text-foreground ${right ? 'ml-auto' : ''}`} onClick={() => onSort(column)}>
      {label} {icon}
    </button>
  );
}

/** Row "…" menu with a single destructive Delete (the only row action the ledgers have). */
export function DeleteRowMenu({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${label}`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface Props<T extends { id: string; amount: string }> {
  title: string;
  columns: DataTableColumn<T>[];
  data: LedgerListResponse<T> | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  page: number;
  onPage: (p: number) => void;
  pageSize: number;
  emptyMessage: string;
}

/** Table inside a card: header with result count + filtered total, footer with page total + pagination. */
export function LedgerTable<T extends { id: string; amount: string }>({ title, columns, data, loading, error, onRetry, page, onPage, pageSize, emptyMessage }: Props<T>) {
  const sym = useCurrencySymbol();
  const items = data?.items ?? [];
  const pageTotal = items.reduce((s, r) => s + num(r.amount), 0);
  return (
    <section className="overflow-hidden rounded-[20px] border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-[18px]">
        <h2 className="text-[17px] font-extrabold">
          {title}{' '}
          {data ? (
            <span className="text-sm font-semibold text-muted-foreground">
              · {data.total} result{data.total === 1 ? '' : 's'}
              {data.summary ? ` · ${formatMoney(sym, data.summary.total)} total · ${formatMoney(sym, data.summary.average)} avg` : ''}
            </span>
          ) : null}
        </h2>
      </div>
      <div className="px-3 pb-3 sm:px-4">
        <DataTable columns={columns} rows={items} rowKey={(r) => r.id} loading={loading} error={error} onRetry={onRetry} emptyMessage={emptyMessage} />
      </div>
      {data && data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-[13px] font-semibold text-muted-foreground">
          <span>
            Page total <b className="text-foreground">{formatMoney(sym, pageTotal)}</b>
            {data.summary ? (
              <>
                {' '}
                · All {data.summary.count} filtered <b className="text-foreground">{formatMoney(sym, data.summary.total)}</b>
              </>
            ) : null}
          </span>
          <Pagination page={page} totalPages={data.totalPages} onPageChange={onPage} totalItems={data.total} pageSize={pageSize} />
        </div>
      ) : null}
    </section>
  );
}
