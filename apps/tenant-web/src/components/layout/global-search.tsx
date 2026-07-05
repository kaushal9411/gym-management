'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { SearchBar } from '@/components/ui/search-bar';
import { useFilteredNav } from '@/features/navigation/use-filtered-nav';

/**
 * Client-side filter over the visible nav catalog — a real cross-entity
 * search (members, staff, payments…) needs those modules' data first;
 * this keeps the header's search slot functional and future-ready.
 */
export function GlobalSearch() {
  const router = useRouter();
  const items = useFilteredNav();
  const [query, setQuery] = React.useState('');
  const [focused, setFocused] = React.useState(false);

  const matches = query.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <div className="relative hidden w-full max-w-sm md:block">
      <SearchBar
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder="Search modules…"
      />
      {focused && matches.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
          {matches.map((item) => (
            <button
              key={item.key}
              type="button"
              onMouseDown={() => {
                router.push(item.href);
                setQuery('');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <item.icon className="size-4 text-muted-foreground" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
