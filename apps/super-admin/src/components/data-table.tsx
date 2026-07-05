import * as React from 'react';

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
  emptyMessage?: string;
}

/** One reusable table shell for every admin list view (tenants, plans, coupons, payments, tickets, roles, audit logs). */
export function DataTable<T>({ columns, rows, rowKey, emptyMessage = 'Nothing to show yet.' }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
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
