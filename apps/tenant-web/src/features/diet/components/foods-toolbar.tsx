'use client';

import { Grid2x2, List, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { accentVar, type Accent } from '@/features/members/components/detail/detail-ui';

export const FOOD_SORT_OPTIONS = [
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'category:asc', label: 'Category (A–Z)' },
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
] as const;

const STATUS_CHIPS: Array<{ value: 'true' | 'false' | ''; label: string; accent: Accent }> = [
  { value: '', label: 'All', accent: 'primary' },
  { value: 'true', label: 'Active', accent: 'success' },
  { value: 'false', label: 'Inactive', accent: 'warning' },
];

interface FoodsToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  status: 'true' | 'false' | '';
  onStatus: (v: 'true' | 'false' | '') => void;
  sort: string;
  onSort: (v: string) => void;
  view: 'grid' | 'list';
  onView: (v: 'grid' | 'list') => void;
}

/** Same sticky/blurred toolbar shape as `ExercisesToolbar`/`WorkoutPlansToolbar`. */
export function FoodsToolbar({ search, onSearch, status, onStatus, sort, onSort, view, onView }: FoodsToolbarProps) {
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card/90 p-2.5 shadow-sm backdrop-blur">
      <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border bg-background px-3 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name, category…"
          aria-label="Search foods"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {STATUS_CHIPS.map((c) => {
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

      <select
        className="h-10 rounded-xl border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring"
        value={sort}
        onChange={(e) => onSort(e.target.value)}
        aria-label="Sort by"
      >
        {FOOD_SORT_OPTIONS.map((o) => (
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
