'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, Chip } from '@/features/dashboard/components/ui';
import { fmtInt } from '@/features/dashboard/components/format';
import { TableScroll, fmtDate, fmtDateTime, money, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import type { PaymentRow, PaymentSummary } from '../api/insights';
import { CopyButton, LINK, ModeChip, ProviderChip, StatusChip, relTime } from './pay-kit';

function SortTh({ label, col, sort, dir, onSort, right }: { label: string; col: string; sort: string; dir: 'asc' | 'desc'; onSort: (s: string, d: 'asc' | 'desc') => void; right?: boolean }) {
  const on = sort === col;
  return (
    <th scope="col" aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${thClass} ${right ? 'text-right' : ''}`}>
      <button type="button" onClick={() => onSort(col, on && dir === 'desc' ? 'asc' : 'desc')} className="inline-flex items-center gap-1 rounded-sm font-semibold uppercase tracking-wide outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {label}{on ? (dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : null}
      </button>
    </th>
  );
}

export function PaymentsTable({ rows, loading, now, sort, dir, onSort, onReset }: {
  rows: PaymentRow[]; loading: boolean; now: number | null; sort: string; dir: 'asc' | 'desc'; onSort: (s: string, d: 'asc' | 'desc') => void; onReset: () => void;
}) {
  const router = useRouter();
  if (loading) return <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading payments">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>;
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center gap-2 px-4 py-14 text-center">
        <SearchX className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-semibold">No payments match these filters</p>
        <Button size="sm" variant="outline" onClick={onReset}>Reset filters</Button>
      </div>
    );
  }
  return (
    <TableScroll label="Payments">
      <table className="w-full min-w-[1080px] border-collapse">
        <thead>
          <tr>
            <SortTh label="Date" col="createdAt" sort={sort} dir={dir} onSort={onSort} />
            <th scope="col" className={thClass}>Tenant</th>
            <th scope="col" className={thClass}>Plan</th>
            <th scope="col" className={thClass}>Provider</th>
            <th scope="col" className={thClass}>Mode</th>
            <SortTh label="Amount" col="amount" sort={sort} dir={dir} onSort={onSort} right />
            <th scope="col" className={thClass}>Status</th>
            <th scope="col" className={thClass}>Gateway ref</th>
            <th scope="col" className={thClass}>Failure reason</th>
            <th scope="col" className={thClass}>Invoice</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} onClick={() => router.push(`/payments/${p.id}`)} className="cursor-pointer transition-colors hover:bg-muted/50">
              <td className={`${tdClass} whitespace-nowrap`}>
                <Link href={`/payments/${p.id}`} onClick={(e) => e.stopPropagation()} className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="block font-medium">{relTime(p.paidAt ?? p.createdAt, now) || fmtDate(p.paidAt ?? p.createdAt)}</span>
                  <span className="block text-xs text-muted-foreground">{fmtDateTime(p.paidAt ?? p.createdAt)}</span>
                </Link>
              </td>
              <td className={tdClass}>
                <Link href={`/tenants/${p.tenant.id}`} onClick={(e) => e.stopPropagation()} className={`${LINK} inline-flex items-center gap-2`}>
                  <Avatar name={p.tenant.name} seed={p.tenant.id} /><span className="max-w-[160px] truncate">{p.tenant.name}</span>
                </Link>
              </td>
              <td className={tdClass}>{p.planName ? <Chip tone="blue">{p.planName}</Chip> : <span className="text-muted-foreground">—</span>}</td>
              <td className={tdClass}><ProviderChip provider={p.provider} /></td>
              <td className={tdClass}><ModeChip mode={p.paymentMode} /></td>
              <td className={`${tdClass} whitespace-nowrap text-right font-semibold tabular-nums`}>{money(p.amount, p.currency)}</td>
              <td className={tdClass}><StatusChip status={p.status} /></td>
              <td className={tdClass}>
                {p.gatewayReference ? <span className="flex items-center gap-1"><span className="max-w-[140px] truncate font-mono text-xs" title={p.gatewayReference}>{p.gatewayReference}</span><CopyButton value={p.gatewayReference} label="gateway reference" /></span> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className={`${tdClass} max-w-[200px]`}>{p.failureReason ? <span className="block truncate text-red-700 dark:text-red-400" title={p.failureReason}>{p.failureReason}</span> : <span className="text-muted-foreground">—</span>}</td>
              <td className={tdClass}>
                {p.invoiceId && p.invoiceNumber ? <Link href={`/payments/invoices/${p.invoiceId}`} onClick={(e) => e.stopPropagation()} className={`${LINK} font-mono text-xs`}>{p.invoiceNumber}</Link> : <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

/** Totals for the whole filtered set (not just the page). */
export function PaymentsSummaryBar({ s }: { s: PaymentSummary }) {
  const cur = s.currency ?? 'INR';
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t bg-muted/30 px-4 py-2.5 text-[13px]">
      <span className="text-muted-foreground">{fmtInt(s.count)} matching</span>
      <span>Succeeded <b className="tabular-nums text-green-700 dark:text-green-400">{money(s.succeededAmount, cur)}</b></span>
      <span>Pending <b className="tabular-nums text-amber-800 dark:text-amber-300">{money(s.pendingAmount, cur)}</b></span>
      <span>Failed <b className="tabular-nums text-red-700 dark:text-red-400">{money(s.failedAmount, cur)}</b></span>
      {s.mixedCurrency ? <Chip tone="amber">Mixed currencies: totals are not converted</Chip> : null}
    </div>
  );
}
