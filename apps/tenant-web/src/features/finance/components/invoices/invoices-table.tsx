'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ExternalLink, Mail, MoreHorizontal, Receipt } from 'lucide-react';
import { toast } from 'sonner';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { EmptyState } from '@/features/reports/components/ui';
import { staggerDelay, useMotionSafe } from '@/features/reports/lib/motion';
import { useCurrencySymbol } from '@/lib/currency';
import { toFinanceError, useEmailInvoice } from '../../hooks/use-finance';
import { financeService } from '../../services/finance.service';
import type { InvoiceListResponse, ListInvoicesParams, MemberInvoiceListItem } from '../../types';
import { InvoiceStatusBadge } from '../finance-badges';
import { MemberAvatar, fmtDate } from '../payments/payments-ui';
import { dueInfo } from './invoice-list-utils';

type SortableColumn = NonNullable<ListInvoicesParams['sortBy']>;

function RowActions({ inv }: { inv: MemberInvoiceListItem }) {
  const email = useEmailInvoice();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${inv.invoiceNumber}`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/invoices/${inv.id}`}>
            <ExternalLink className="size-4" /> View invoice
          </Link>
        </DropdownMenuItem>
        {/* Download/Email are gated by the caller passing `canDownload`. */}
        <DropdownMenuItem
          onSelect={() => {
            financeService.downloadInvoicePdfUrl(inv.id, inv.invoiceNumber).catch((err: unknown) => toast.error(toFinanceError(err).message));
          }}
        >
          <Download className="size-4" /> Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            email.mutate({ id: inv.id }, { onSuccess: () => toast.success('Invoice emailed.'), onError: (err) => toast.error(toFinanceError(err).message) })
          }
        >
          <Mail className="size-4" /> Email invoice
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowMenu({ inv, canDownload }: { inv: MemberInvoiceListItem; canDownload: boolean }) {
  if (canDownload) return <RowActions inv={inv} />;
  return (
    <Link href={`/invoices/${inv.id}`} aria-label={`View ${inv.invoiceNumber}`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
      <ExternalLink className="size-4" />
    </Link>
  );
}

export function InvoicesTable({
  data,
  loading,
  error,
  onRetry,
  page,
  onPage,
  pageSize,
  sortBy,
  sortDir,
  onSort,
  canDownload,
}: {
  data: InvoiceListResponse | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  page: number;
  onPage: (p: number) => void;
  pageSize: number;
  sortBy: SortableColumn;
  sortDir: 'asc' | 'desc';
  onSort: (c: SortableColumn) => void;
  canDownload: boolean;
}) {
  const sym = useCurrencySymbol();
  const m = useMotionSafe();
  const items = data?.items ?? [];
  const sortHeader = (label: string, c: SortableColumn, right?: boolean) => (
    <button type="button" className={`flex items-center gap-1 font-medium hover:text-foreground ${right ? 'ml-auto' : ''}`} onClick={() => onSort(c)}>
      {label} {sortBy !== c ? <ArrowUpDown className="size-3.5 opacity-60" /> : sortDir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
    </button>
  );
  const th = 'whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted-foreground';

  return (
    <section className="overflow-hidden rounded-[20px] border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-[18px]">
        <h2 className="text-[17px] font-extrabold">
          All invoices{' '}
          {data ? (
            <span className="text-sm font-semibold text-muted-foreground">
              · {data.total} result{data.total === 1 ? '' : 's'}
            </span>
          ) : null}
        </h2>
      </div>
      <div className="overflow-x-auto px-3 pb-3 sm:px-4">
        {error && !data ? (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
            Couldn&apos;t load invoices.
            <button type="button" className="font-semibold text-primary hover:underline" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices match these filters" description="Try widening the period or clearing the status and amount filters." compact />
        ) : (
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className={th}>Invoice</th>
                <th className={th}>Member</th>
                <th className={th}>Branch</th>
                <th className={th}>{sortHeader('Invoice date', 'invoiceDate')}</th>
                <th className={th}>{sortHeader('Due date', 'dueDate')}</th>
                <th className={`${th} text-right`}>{sortHeader('Total', 'totalAmount', true)}</th>
                <th className={th}>Status</th>
                <th className={`${th} w-10`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv, i) => {
                const due = dueInfo(inv.dueDate, inv.status);
                return (
                  <motion.tr
                    key={inv.id}
                    initial={m.reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: staggerDelay(i, 0.03, 10) }}
                    className="border-b last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${inv.id}`} className="font-bold tabular-nums text-primary hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2.5">
                        <MemberAvatar name={inv.member.name} seed={inv.member.id} />
                        <span>
                          <b className="block font-semibold">{inv.member.name}</b>
                          <span className="block text-xs text-muted-foreground">{inv.member.memberId}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">{inv.branch.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">{fmtDate(inv.invoiceDate, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {fmtDate(inv.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {due ? (
                        <span className="mt-0.5 block text-xs font-bold" style={{ color: due.color }}>
                          {due.label}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold tabular-nums">{formatMoney(sym, inv.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowMenu inv={inv} canDownload={canDownload} />
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {data && data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-[13px] font-semibold text-muted-foreground">
          {data.summary ? (
            <span>
              Filtered: invoiced <b className="text-foreground">{formatMoney(sym, data.summary.invoiced)}</b> · collected <b className="text-foreground">{formatMoney(sym, data.summary.collected)}</b> · outstanding{' '}
              <b className="text-foreground">{formatMoney(sym, data.summary.outstanding)}</b>
            </span>
          ) : (
            <span />
          )}
          <Pagination page={page} totalPages={data.totalPages} onPageChange={onPage} totalItems={data.total} pageSize={pageSize} />
        </div>
      ) : null}
    </section>
  );
}
