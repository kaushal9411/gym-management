'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RotateCw, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencySymbol } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { staggerDelay, useMotionSafe } from '../../lib/motion';
import { accentWash, type ReportAccent } from '../../lib/reports-theme';
import type { TabularReportType } from '../../types';
import { EmptyState } from '../ui';
import { isNumericKind, renderCell, REPORT_COLUMNS, rowKeyFor } from './report-columns';

type ReportRow = Record<string, unknown>;

interface ReportTableCardProps {
  type: TabularReportType;
  rows: ReportRow[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  accent: ReportAccent;
  page: number;
  onPage: (p: number) => void;
  pageSize: number;
  total: number | null;
  totalPages: number;
}

/** Report rows in a card: sticky header, zebra + hover rows, animated (capped) row entrance, count footer + pagination. */
export function ReportTableCard({ type, rows, loading, error, onRetry, accent, page, onPage, pageSize, total, totalPages }: ReportTableCardProps) {
  const m = useMotionSafe();
  const symbol = useCurrencySymbol();
  const columns = REPORT_COLUMNS[type];

  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border bg-card text-card-foreground shadow-xs print:rounded-none print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5" style={{ backgroundImage: accentWash(accent) }}>
        <h2 className="text-[17px] font-extrabold">Detailed rows</h2>
        <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
          {loading ? 'Loading…' : total !== null ? `${total.toLocaleString()} result${total === 1 ? '' : 's'}` : `${rows.length} result${rows.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {error ? (
        <div className="p-5">
          <EmptyState
            icon={AlertTriangle}
            accent="staff"
            title="Couldn't load this report"
            description={error instanceof Error ? error.message : 'Something went wrong loading this data.'}
            action={
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCw className="size-4" /> Retry
              </Button>
            }
          />
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="space-y-2 p-5" aria-busy>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={SearchX} accent={accent} title="No data matches these filters" description="Try a wider period or clear a filter." />
        </div>
      ) : (
        <div className={cn('max-h-[640px] overflow-auto print:max-h-none print:overflow-visible', loading && 'opacity-60 transition-opacity')}>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
              <tr className="border-b text-left text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {columns.map((col) => (
                  <th key={col.key} className={cn('whitespace-nowrap px-4 py-3', isNumericKind(col.kind) && 'text-right')}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <motion.tr
                  key={`${page}:${rowKeyFor(type, row, i)}`}
                  initial={m.reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: staggerDelay(i, 0.025, 12) }}
                  className="border-b border-border/60 transition-colors last:border-0 even:bg-muted/30 hover:bg-accent/60 print:break-inside-avoid"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 align-middle', isNumericKind(col.kind) && 'text-right')}>
                      {renderCell(col, row[col.key], symbol)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && !error ? (
        <div className="border-t px-5 py-3 print:hidden">
          <Pagination page={page} totalPages={totalPages} onPageChange={onPage} totalItems={total ?? undefined} pageSize={pageSize} />
        </div>
      ) : null}
    </section>
  );
}
