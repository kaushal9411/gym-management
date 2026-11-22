'use client';

import * as React from 'react';
import { ChevronRight, ReceiptIndianRupee, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { formatMonth } from '../../lib/dates';
import { mix } from '../../lib/hr-palette';
import { inr } from '../../lib/money';
import { PAYSLIP_STATUS_TONE } from '../../lib/status';
import { hrService } from '../../services/hr.service';
import { useMePayslip, useMePayslips } from '../../hooks/use-hr';
import { PayslipView } from '../payroll/payslip-view';
import { HrEmpty, HrError, HrPanel, RowsSkeleton, ToneChip } from '../ui/hr-ui';

export function MyPayslipsTab() {
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<string | null>(null);
  const list = useMePayslips({ page, limit: 12 });
  const detail = useMePayslip(selected);

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <HrPanel title="My payslips" subtitle="Available once payroll is approved" icon={ReceiptIndianRupee} tone="var(--success)">
        {list.isPending ? (
          <RowsSkeleton rows={4} height={64} />
        ) : list.isError ? (
          <HrError onRetry={() => void list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <HrEmpty icon={ReceiptIndianRupee} title="No payslips yet" description="Your payslip appears here after the month's payroll is approved." compact />
        ) : (
          <div className="space-y-2">
            {list.data.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                aria-pressed={selected === p.id}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected === p.id && 'border-primary shadow-sm',
                )}
                style={selected === p.id ? { backgroundColor: mix('var(--primary)', 8) } : undefined}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{formatMonth(p.month)}</p>
                  <p className="text-xs text-muted-foreground">Gross {inr(p.grossEarnings)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold tabular-nums">{inr(p.netPay)}</p>
                  <ToneChip tone={PAYSLIP_STATUS_TONE[p.status]} label={p.status === 'PAID' ? 'Paid' : 'Approved'} small />
                </div>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </button>
            ))}
            {list.data.totalPages > 1 ? <Pagination page={page} totalPages={list.data.totalPages} onPageChange={setPage} totalItems={list.data.total} pageSize={12} /> : null}
          </div>
        )}
      </HrPanel>

      {selected ? (
        <div className="min-w-0">
          <div className="mb-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X className="size-4" /> Close payslip
            </Button>
          </div>
          {detail.isPending ? <RowsSkeleton rows={1} height={420} /> : detail.isError ? <HrError onRetry={() => void detail.refetch()} /> : <PayslipView slip={detail.data} onPdf={() => hrService.me.payslipPdf(selected)} />}
        </div>
      ) : (
        <div className="hidden lg:block">
          <HrEmpty icon={ReceiptIndianRupee} title="Select a payslip" description="Pick a month to see the full breakdown, print it or download the PDF." />
        </div>
      )}
    </div>
  );
}
