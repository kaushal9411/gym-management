import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  /** Truthy when the underlying query failed — takes priority over `loading`/empty. Pass `query.error`. */
  error?: unknown;
  /** Shown as the Retry button's handler in the error state — pass `query.refetch`. Omitted → no Retry button. */
  onRetry?: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong loading this data.';
}

/** Generic table shell reused across every tenant-portal list view (members, staff, payments, etc.). Extended in Prompt 23 (Global Loading & Performance Optimization) with a distinct error/retry state — previously a failed query had no dedicated rendering path and silently fell through to the empty state. */
export function DataTable<T>({ columns, rows, rowKey, loading, emptyMessage = 'Nothing to show yet.', error, onRetry }: DataTableProps<T>) {
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load this data"
        description={errorMessage(error)}
        className="border-destructive/30"
        action={onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button> : undefined}
      />
    );
  }

  if (loading) {
    return <TableSkeleton />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} className="border" />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border shadow-xs">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b bg-background/95 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn('whitespace-nowrap px-4 py-3 font-medium', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors duration-100 hover:bg-accent/50">
              {columns.map((col) => (
                <td key={col.key} className={cn('whitespace-nowrap px-4 py-3', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
