'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { useAuditLogs } from '@/features/audit/hooks/use-audit';
import type { AuditLogEntry } from '@/features/audit/types';

export default function AuditLogsPage() {
  const [action, setAction] = React.useState('');
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useAuditLogs({ action: action || undefined, page, limit: 25 });

  const columns: DataTableColumn<AuditLogEntry>[] = [
    { key: 'action', header: 'Action', render: (log) => <span className="font-mono text-xs">{log.action}</span> },
    { key: 'entity', header: 'Entity', render: (log) => (log.entityType ? `${log.entityType}${log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ''}` : '—') },
    { key: 'actor', header: 'Actor', render: (log) => log.adminUser?.name ?? 'System' },
    { key: 'role', header: 'Role', render: (log) => log.actorRole ?? '—' },
    { key: 'createdAt', header: 'When', render: (log) => new Date(log.createdAt).toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">Every admin action — login, tenant changes, subscription/payment changes, settings changes.</p>
      </div>

      <Input
        placeholder="Filter by exact action (e.g. admin.tenant_status_changed)…"
        value={action}
        onChange={(e) => {
          setAction(e.target.value);
          setPage(1);
        }}
        className="sm:max-w-md"
      />

      {isLoading || !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(log) => log.id} emptyMessage="No audit entries yet." />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
