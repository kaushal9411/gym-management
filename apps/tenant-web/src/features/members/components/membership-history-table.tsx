import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { useCurrencySymbol } from '@/lib/currency';
import { MembershipStatusBadge } from './member-status-badge';
import type { MembershipFreezeEntry, MembershipHistoryEntry, MembershipTransfer } from '../types';

/** The one-line story of a membership row that came from / went to a transfer, or null for an ordinary one. */
function transferNote(entryId: string, transfers: MembershipTransfer[]): string | null {
  const sent = transfers.find((t) => t.fromMembershipId === entryId);
  if (sent) return `Transferred to ${sent.toMember.name} on ${new Date(sent.transferredAt).toLocaleDateString()}`;
  const received = transfers.find((t) => t.toMembershipId === entryId);
  if (received) return `Received from ${received.fromMember.name} on ${new Date(received.transferredAt).toLocaleDateString()}`;
  return null;
}

export function MembershipHistoryTable({ entries, transfers = [] }: { entries: MembershipHistoryEntry[]; transfers?: MembershipTransfer[] }) {
  const currencySymbol = useCurrencySymbol();
  const columns: DataTableColumn<MembershipHistoryEntry>[] = [
    { key: 'plan', header: 'Plan', render: (entry) => entry.planName },
    { key: 'start', header: 'Start', render: (entry) => new Date(entry.startDate).toLocaleDateString() },
    { key: 'end', header: 'End', render: (entry) => new Date(entry.endDate).toLocaleDateString() },
    { key: 'price', header: 'Price', render: (entry) => `${currencySymbol}${entry.priceAtAssignment}` },
    { key: 'targetWeight', header: 'Target weight', render: (entry) => (entry.targetWeight ? `${entry.targetWeight} kg` : '—') },
    {
      key: 'status',
      header: 'Status',
      render: (entry) => {
        const note = transferNote(entry.id, transfers);
        return (
          <div className="space-y-1">
            <MembershipStatusBadge status={entry.status} />
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          </div>
        );
      },
    },
    { key: 'autoRenew', header: 'Auto-renew', render: (entry) => (entry.autoRenew ? 'Yes' : 'No') },
  ];
  return <DataTable columns={columns} rows={entries} rowKey={(entry) => entry.id} emptyMessage="No membership history yet." />;
}

/** Every membership transfer this member sent or received — who gave it to whom, what moved, the fee, and why. */
export function MembershipTransferHistoryTable({ transfers, memberId }: { transfers: MembershipTransfer[]; memberId: string }) {
  const currencySymbol = useCurrencySymbol();
  const columns: DataTableColumn<MembershipTransfer>[] = [
    { key: 'date', header: 'Date', render: (t) => new Date(t.transferredAt).toLocaleDateString() },
    { key: 'direction', header: 'Direction', render: (t) => (t.fromMember.id === memberId ? 'Sent' : 'Received') },
    { key: 'from', header: 'From', render: (t) => `${t.fromMember.name} (${t.fromMember.memberId})` },
    { key: 'to', header: 'To', render: (t) => `${t.toMember.name} (${t.toMember.memberId})` },
    { key: 'plan', header: 'Plan', render: (t) => `${t.planName} · ${currencySymbol}${t.priceAtAssignment}` },
    { key: 'days', header: 'Used / left', render: (t) => `${t.daysUsed} / ${t.daysRemaining} days` },
    { key: 'fee', header: 'Transfer fee', render: (t) => (Number(t.fee) > 0 ? `${currencySymbol}${t.fee}` : 'Waived') },
    { key: 'reason', header: 'Reason', render: (t) => t.reason ?? '—' },
    { key: 'by', header: 'Done by', render: (t) => t.transferredByName ?? '—' },
  ];
  return <DataTable columns={columns} rows={transfers} rowKey={(t) => t.id} emptyMessage="No membership transfers yet." />;
}

export function FreezeHistoryTable({ entries }: { entries: MembershipFreezeEntry[] }) {
  const columns: DataTableColumn<MembershipFreezeEntry>[] = [
    { key: 'frozenAt', header: 'Frozen at', render: (entry) => new Date(entry.frozenAt).toLocaleString() },
    { key: 'unfrozenAt', header: 'Unfrozen at', render: (entry) => (entry.unfrozenAt ? new Date(entry.unfrozenAt).toLocaleString() : 'Still frozen') },
    { key: 'reason', header: 'Reason', render: (entry) => entry.reason ?? '—' },
  ];
  return <DataTable columns={columns} rows={entries} rowKey={(entry) => entry.id} emptyMessage="No freeze history yet." />;
}
