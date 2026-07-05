'use client';

import * as React from 'react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { useTickets } from '@/features/support/hooks/use-tickets';
import type { TicketListItem, TicketPriority, TicketStatus } from '@/features/support/types';

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-primary/10 text-primary',
  HIGH: 'bg-warning/15 text-warning-foreground',
  URGENT: 'bg-destructive/10 text-destructive',
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-primary/10 text-primary',
  IN_PROGRESS: 'bg-warning/15 text-warning-foreground',
  RESOLVED: 'bg-success/10 text-success',
  CLOSED: 'bg-muted text-muted-foreground',
};

export default function SupportPage() {
  const [status, setStatus] = React.useState<TicketStatus | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useTickets({ status: status === 'ALL' ? undefined : status, page, limit: 20 });

  const columns: DataTableColumn<TicketListItem>[] = [
    { key: 'subject', header: 'Subject', render: (t) => <Link href={`/support/${t.id}`} className="font-medium text-primary hover:underline">{t.subject}</Link> },
    { key: 'tenant', header: 'Tenant', render: (t) => t.tenant?.name ?? '—' },
    { key: 'requester', header: 'Requester', render: (t) => t.createdByEmail },
    { key: 'priority', header: 'Priority', render: (t) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span> },
    { key: 'status', header: 'Status', render: (t) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>{t.status.replace('_', ' ')}</span> },
    { key: 'assignee', header: 'Assigned to', render: (t) => t.assignedAdmin?.name ?? 'Unassigned' },
    { key: 'createdAt', header: 'Created', render: (t) => new Date(t.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support Tickets</h1>
        <p className="text-muted-foreground">View, assign, and resolve support requests.</p>
      </div>

      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value as TicketStatus | 'ALL');
          setPage(1);
        }}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm sm:w-48"
      >
        <option value="ALL">All statuses</option>
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="RESOLVED">Resolved</option>
        <option value="CLOSED">Closed</option>
      </select>

      {isLoading || !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(t) => t.id} emptyMessage="No tickets match your filters." />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
