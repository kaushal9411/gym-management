import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { MembershipStatusBadge } from './member-status-badge';
import type { MembershipFreezeEntry, MembershipHistoryEntry } from '../types';

export function MembershipHistoryTable({ entries }: { entries: MembershipHistoryEntry[] }) {
  const columns: DataTableColumn<MembershipHistoryEntry>[] = [
    { key: 'plan', header: 'Plan', render: (entry) => entry.planName },
    { key: 'start', header: 'Start', render: (entry) => new Date(entry.startDate).toLocaleDateString() },
    { key: 'end', header: 'End', render: (entry) => new Date(entry.endDate).toLocaleDateString() },
    { key: 'price', header: 'Price', render: (entry) => `$${entry.priceAtAssignment}` },
    { key: 'status', header: 'Status', render: (entry) => <MembershipStatusBadge status={entry.status} /> },
    { key: 'autoRenew', header: 'Auto-renew', render: (entry) => (entry.autoRenew ? 'Yes' : 'No') },
  ];
  return <DataTable columns={columns} rows={entries} rowKey={(entry) => entry.id} emptyMessage="No membership history yet." />;
}

export function FreezeHistoryTable({ entries }: { entries: MembershipFreezeEntry[] }) {
  const columns: DataTableColumn<MembershipFreezeEntry>[] = [
    { key: 'frozenAt', header: 'Frozen at', render: (entry) => new Date(entry.frozenAt).toLocaleString() },
    { key: 'unfrozenAt', header: 'Unfrozen at', render: (entry) => (entry.unfrozenAt ? new Date(entry.unfrozenAt).toLocaleString() : 'Still frozen') },
    { key: 'reason', header: 'Reason', render: (entry) => entry.reason ?? '—' },
  ];
  return <DataTable columns={columns} rows={entries} rowKey={(entry) => entry.id} emptyMessage="No freeze history yet." />;
}
