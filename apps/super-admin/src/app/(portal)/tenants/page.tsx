'use client';

import * as React from 'react';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { useTenants } from '@/features/tenants/hooks/use-tenants';
import type { TenantListItem, TenantStatus } from '@/features/tenants/types';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: Array<{ value: TenantStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'TRIAL', label: 'Trial' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAST_DUE', label: 'Past due' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_STYLES: Record<string, string> = {
  TRIAL: 'bg-primary/10 text-primary',
  ACTIVE: 'bg-success/10 text-success',
  PAST_DUE: 'bg-warning/15 text-warning-foreground',
  SUSPENDED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
};

export default function TenantsPage() {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<TenantStatus | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useTenants({ search: search || undefined, status: status === 'ALL' ? undefined : status, page, limit: 20 });

  const columns: DataTableColumn<TenantListItem>[] = [
    { key: 'name', header: 'Gym', render: (t) => <Link href={`/tenants/${t.id}`} className="font-medium text-primary hover:underline">{t.name}</Link> },
    { key: 'slug', header: 'Subdomain', render: (t) => `${t.slug}.fitcloud.com` },
    { key: 'owner', header: 'Owner', render: (t) => t.owner?.email ?? '—' },
    { key: 'plan', header: 'Plan', render: (t) => t.plan ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[t.status] ?? 'bg-muted')}>{t.status}</span>,
    },
    { key: 'createdAt', header: 'Created', render: (t) => new Date(t.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        <p className="text-muted-foreground">Every gym on the platform — search, filter, and manage.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by gym name or subdomain…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TenantStatus | 'ALL');
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm sm:w-48"
        >
          {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(t) => t.id} emptyMessage="No tenants match your filters." />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
