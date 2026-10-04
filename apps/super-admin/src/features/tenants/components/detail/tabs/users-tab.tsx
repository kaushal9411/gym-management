'use client';

/**
 * Users tab (read-only). Data: GET …/users (page 1, limit 100: staff incl. owner) — search, status chips and KPIs are computed
 * client-side over the loaded rows; `counts` from the API supply totals/active/MFA. Dropped: branch column (the endpoint returns
 * no branch). Owner actions (reset password, force logout) live in the page's control panel, not here.
 */
import * as React from 'react';
import { Search } from 'lucide-react';

import { Avatar, Chip, EmptyNote, Panel, type ChipTone } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { useTenantUsers } from '../../../api/tabs';
import { CountChips, ErrorNote, MixBar, Stat, StatRow, TabSkeleton, TableScroll, fieldClass, relTime, statusLabel, statusTone, tdClass, thClass, type TabProps } from './_shared/kit';

const ROLE_TONE: Record<string, ChipTone> = { OWNER: 'violet', MANAGER: 'blue', TRAINER: 'green', RECEPTIONIST: 'amber' };
const ROLE_COLOR: Record<string, string> = { OWNER: 'var(--chart-3)', MANAGER: 'var(--chart-2)', TRAINER: 'var(--chart-6)', RECEPTIONIST: 'var(--chart-4)' };
const WEEK = 7 * 86_400_000;

export function UsersTab({ tenantId }: TabProps) {
  const q = useTenantUsers(tenantId);
  const now = useNow(60_000);
  const [status, setStatus] = React.useState('ALL');
  const [search, setSearch] = React.useState('');

  if (q.isLoading) return <TabSkeleton rows={5} />;
  if (q.isError) return <ErrorNote what="staff users" message={q.error?.message} onRetry={() => void q.refetch()} />;
  const data = q.data;
  if (!data || data.items.length === 0) return <EmptyNote>No staff users found for this tenant.</EmptyNote>;

  const items = data.items;
  const byStatus = new Map<string, number>();
  for (const u of items) byStatus.set(u.status, (byStatus.get(u.status) ?? 0) + 1);
  const term = search.trim().toLowerCase();
  const view = items.filter((u) => (status === 'ALL' || u.status === status) && (!term || `${u.name} ${u.email} ${u.roles.join(' ')}`.toLowerCase().includes(term)));
  const mfaPct = data.counts.total ? Math.round((data.counts.mfaEnabled / data.counts.total) * 100) : 0;
  const recent = now === null ? null : items.filter((u) => u.lastLoginAt && now - new Date(u.lastLoginAt).getTime() <= WEEK).length;
  const roleCounts = new Map<string, number>();
  for (const u of items) roleCounts.set(u.role, (roleCounts.get(u.role) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <StatRow>
        <Stat index={0} label="Staff total" value={String(data.counts.total)} caption="incl. owner" />
        <Stat index={1} label="Active" value={String(data.counts.active)} caption={`${data.counts.total - data.counts.active} not active`} />
        <Stat index={2} label="MFA coverage" value={`${mfaPct}%`} caption={`${data.counts.mfaEnabled} of ${data.counts.total} with MFA`} tone={mfaPct === 0 ? undefined : 'good'} />
        <Stat index={3} label="Signed in, 7 days" value={recent === null ? '—' : String(recent)} caption="by last login" />
      </StatRow>
      <Panel title="Role distribution" index={1}>
        <MixBar label="Staff by role" items={[...roleCounts.entries()].map(([r, v]) => ({ label: statusLabel(r), value: v, color: ROLE_COLOR[r] ?? 'var(--chart-7)' }))} />
      </Panel>
      <Panel title="Staff" hint={`${view.length} of ${items.length}`} index={2}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input type="search" aria-label="Search staff" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or role" className={`${fieldClass} pl-8`} />
          </div>
          <CountChips label="Status filter" value={status} onChange={setStatus} options={[{ value: 'ALL', label: 'All', count: items.length }, ...[...byStatus.entries()].map(([s, c]) => ({ value: s, label: statusLabel(s), count: c }))]} />
        </div>
        <TableScroll label="Staff users">
          <table className="w-full min-w-[640px] border-collapse">
            <thead><tr><th className={thClass}>User</th><th className={thClass}>Role</th><th className={thClass}>Status</th><th className={thClass}>Last login</th><th className={thClass}>MFA</th></tr></thead>
            <tbody>
              {view.length === 0 ? <tr><td colSpan={5} className={`${tdClass} text-center text-muted-foreground`}>No staff match this filter.</td></tr> : view.map((u) => (
                <tr key={u.id}>
                  <td className={tdClass}>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} seed={u.email} />
                      <div className="min-w-0"><p className="truncate font-medium">{u.name}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
                    </div>
                  </td>
                  <td className={tdClass}><span className="flex flex-wrap gap-1">{u.roles.map((r) => <Chip key={r} tone={ROLE_TONE[r] ?? 'slate'}>{statusLabel(r)}</Chip>)}</span></td>
                  <td className={tdClass}><Chip tone={statusTone(u.status)}>{statusLabel(u.status)}</Chip></td>
                  <td className={`${tdClass} whitespace-nowrap`} title={u.lastLoginAt ?? undefined}>{relTime(u.lastLoginAt, now)}</td>
                  <td className={tdClass}><Chip tone={u.mfaEnabled ? 'green' : 'slate'}>{u.mfaEnabled ? 'MFA on' : 'MFA off'}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>
    </div>
  );
}
