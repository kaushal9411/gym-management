'use client';

import { Grid2x2, List, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

interface MeasurementsToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  view: 'grid' | 'list';
  onView: (v: 'grid' | 'list') => void;
}

/** Same sticky/blurred toolbar shape as every other list page — search is the only filter here since every row by definition already has at least one measurement. */
export function MeasurementsToolbar({ search, onSearch, view, onView }: MeasurementsToolbarProps) {
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card/90 p-2.5 shadow-sm backdrop-blur">
      <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border bg-background px-3 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name or member ID…"
          aria-label="Search measured members"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

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
