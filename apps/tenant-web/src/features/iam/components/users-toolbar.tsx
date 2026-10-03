'use client';

import { Grid2x2, List, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { RoleDto, UserStats, UserStatus } from '../types';
import { STATUS_LABEL, STATUS_TONE } from './users-overview';

const selectClassName = cn(
  'h-10 rounded-xl border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

interface UsersToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  status: UserStatus | '';
  onStatus: (s: UserStatus | '') => void;
  stats?: UserStats;
  roleId: string;
  onRole: (v: string) => void;
  roles: RoleDto[];
  view: 'grid' | 'list';
  onView: (v: 'grid' | 'list') => void;
}

const CHIPS: Array<{ value: UserStatus | ''; label: string; accent: Accent }> = [
  { value: '', label: 'All', accent: 'primary' },
  { value: 'ACTIVE', label: 'Active', accent: STATUS_TONE.ACTIVE },
  { value: 'PENDING_VERIFICATION', label: 'Pending', accent: STATUS_TONE.PENDING_VERIFICATION },
  { value: 'LOCKED', label: 'Locked', accent: STATUS_TONE.LOCKED },
  { value: 'SUSPENDED', label: 'Suspended', accent: STATUS_TONE.SUSPENDED },
  { value: 'DEACTIVATED', label: 'Deactivated', accent: STATUS_TONE.DEACTIVATED },
];

export function UsersToolbar({ search, onSearch, status, onStatus, stats, roleId, onRole, roles, view, onView }: UsersToolbarProps) {
  const count = (v: UserStatus | '') => (!stats ? undefined : v === '' ? stats.total : stats.byStatus[v]);
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card/90 p-2.5 shadow-sm backdrop-blur">
      <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border bg-background px-3 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search name, email, phone…" aria-label="Search staff" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {CHIPS.map((c) => {
          const on = status === c.value;
          const n = count(c.value);
          return (
            <button
              key={c.label}
              type="button"
              aria-pressed={on}
              title={c.value ? STATUS_LABEL[c.value] : 'All statuses'}
              onClick={() => onStatus(c.value)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all hover:-translate-y-px"
              style={on ? { backgroundColor: accentVar(c.accent), color: '#fff', borderColor: accentVar(c.accent), boxShadow: `0 8px 18px -10px ${accentVar(c.accent)}` } : undefined}
            >
              {c.label}
              {n !== undefined ? (
                <b className="rounded-full px-1.5 text-[11px]" style={on ? { backgroundColor: 'rgba(255,255,255,.25)' } : { backgroundColor: tint(c.accent, 14), color: accentVar(c.accent) }}>
                  {n}
                </b>
              ) : null}
            </button>
          );
        })}
      </div>

      <select className={selectClassName} value={roleId} onChange={(e) => onRole(e.target.value)} aria-label="Filter by role">
        <option value="">All roles</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      <div className="inline-flex rounded-xl border bg-muted/50 p-0.5" role="group" aria-label="View">
        {([['grid', Grid2x2, 'Cards'], ['list', List, 'Compact list']] as const).map(([v, Icon, label]) => (
          <button key={v} type="button" title={label} aria-label={label} aria-pressed={view === v} onClick={() => onView(v)} className={cn('grid size-9 place-items-center rounded-[10px] text-muted-foreground transition-all', view === v && 'bg-card text-primary shadow-sm')}>
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
