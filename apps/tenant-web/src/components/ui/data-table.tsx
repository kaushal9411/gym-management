import * as React from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

/** Generic table shell reused across every tenant-portal list view (members, staff, payments, etc. once those modules land). */
export function DataTable<T>({ columns, rows, rowKey, loading, emptyMessage = 'Nothing to show yet.' }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} className="border" />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn('whitespace-nowrap px-4 py-2.5 font-medium', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-accent/40">
              {columns.map((col) => (
                <td key={col.key} className={cn('whitespace-nowrap px-4 py-2.5', col.className)}>
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
