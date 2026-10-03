'use client';

import { Grid2x2, List, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { UserStatus, StaffRole, WorkStatus } from '../types';

const selectClassName = cn(
  'h-10 rounded-xl border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

export const STAFF_SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'employeeId:asc', label: 'Employee ID (A–Z)' },
  { value: 'joiningDate:desc', label: 'Joining date (newest)' },
  { value: 'joiningDate:asc', label: 'Joining date (oldest)' },
] as const;

const CHIPS: Array<{ value: UserStatus | ''; label: string; accent: Accent }> = [
  { value: '', label: 'All', accent: 'primary' },
  { value: 'ACTIVE', label: 'Active', accent: 'success' },
  { value: 'PENDING_VERIFICATION', label: 'Pending', accent: 'warning' },
  { value: 'LOCKED', label: 'Locked', accent: 'destructive' },
  { value: 'SUSPENDED', label: 'Suspended', accent: 'aqua' },
];

interface StaffToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  status: UserStatus | '';
  onStatus: (s: UserStatus | '') => void;
  role: StaffRole | '';
  onRole: (v: StaffRole | '') => void;
  workStatus: WorkStatus | '';
  onWorkStatus: (v: WorkStatus | '') => void;
  sort: string;
  onSort: (v: string) => void;
  view: 'grid' | 'list';
  onView: (v: 'grid' | 'list') => void;
}

/** Same sticky/blurred toolbar shape as `MembersToolbar`/`UsersToolbar` — wraps the exact same filter state the page already owned, just restyled. */
export function StaffToolbar({ search, onSearch, status, onStatus, role, onRole, workStatus, onWorkStatus, sort, onSort, view, onView }: StaffToolbarProps) {
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card/90 p-2.5 shadow-sm backdrop-blur">
      <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border bg-background px-3 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name, email, phone, employee ID…"
          aria-label="Search staff"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {CHIPS.map((c) => {
          const on = status === c.value;
          return (
            <button
              key={c.label}
              type="button"
              aria-pressed={on}
              onClick={() => onStatus(c.value)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all hover:-translate-y-px"
              style={on ? { backgroundColor: accentVar(c.accent), color: '#fff', borderColor: accentVar(c.accent), boxShadow: `0 8px 18px -10px ${accentVar(c.accent)}` } : undefined}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <select className={selectClassName} value={role} onChange={(e) => onRole(e.target.value as StaffRole | '')} aria-label="Filter by role">
        <option value="">All roles</option>
        <option value="MANAGER">Manager</option>
        <option value="TRAINER">Trainer</option>
        <option value="RECEPTIONIST">Receptionist</option>
      </select>
      <select className={selectClassName} value={workStatus} onChange={(e) => onWorkStatus(e.target.value as WorkStatus | '')} aria-label="Filter by work status">
        <option value="">All work statuses</option>
        <option value="WORKING">Working</option>
        <option value="ON_LEAVE">On leave</option>
        <option value="NOTICE_PERIOD">Notice period</option>
        <option value="TERMINATED">Terminated</option>
      </select>
      <select className={selectClassName} value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Sort by">
        {STAFF_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <div className="inline-flex rounded-xl border bg-muted/50 p-0.5" role="group" aria-label="View">
        {([['grid', Grid2x2, 'Cards'], ['list', List, 'Compact list']] as const).map(([v, Icon, label]) => (
          <button
            key={v}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={view === v}
            onClick={() => onView(v)}
            className={cn('grid size-9 place-items-center rounded-[10px] text-muted-foreground transition-all', view === v && 'bg-card text-primary shadow-sm')}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
