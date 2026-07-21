import { MembershipStatusBadge } from './member-status-badge';
import type { MembershipFreezeEntry, MembershipHistoryEntry } from '../types';

export function MembershipHistoryTable({ entries }: { entries: MembershipHistoryEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No membership history yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th className="px-3 py-2 font-medium">Start</th>
            <th className="px-3 py-2 font-medium">End</th>
            <th className="px-3 py-2 font-medium">Price</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Auto-renew</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-3 py-2">{entry.planName}</td>
              <td className="px-3 py-2">{new Date(entry.startDate).toLocaleDateString()}</td>
              <td className="px-3 py-2">{new Date(entry.endDate).toLocaleDateString()}</td>
              <td className="px-3 py-2">${entry.priceAtAssignment}</td>
              <td className="px-3 py-2">
                <MembershipStatusBadge status={entry.status} />
              </td>
              <td className="px-3 py-2">{entry.autoRenew ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FreezeHistoryTable({ entries }: { entries: MembershipFreezeEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No freeze history yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Frozen at</th>
            <th className="px-3 py-2 font-medium">Unfrozen at</th>
            <th className="px-3 py-2 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-3 py-2">{new Date(entry.frozenAt).toLocaleString()}</td>
              <td className="px-3 py-2">{entry.unfrozenAt ? new Date(entry.unfrozenAt).toLocaleString() : 'Still frozen'}</td>
              <td className="px-3 py-2">{entry.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
