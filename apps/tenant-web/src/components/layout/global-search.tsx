'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2, UserCog, Users } from 'lucide-react';

import { SearchBar } from '@/components/ui/search-bar';
import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';
import { useGlobalSearch } from '@/features/search/hooks/use-search';
import type { GlobalSearchResultItem } from '@/features/search/types';
import { useFilteredNav } from '@/features/navigation/use-filtered-nav';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

/**
 * Client-side nav-label filter (instant, no network) plus a real
 * cross-entity lookup across Members/Staff/Branches (debounced, backed by
 * `GET /search` — permission-filtered per category server-side, so a
 * category the caller can't view just never appears rather than 403ing).
 */
export function GlobalSearch() {
  const router = useRouter();
  const items = useFilteredNav();
  const [query, setQuery] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: results } = useGlobalSearch(debouncedQuery);

  const navMatches = query.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const groups: { label: string; icon: typeof Users; items: GlobalSearchResultItem[] }[] = [
    { label: 'Members', icon: Users, items: results?.members ?? [] },
    { label: 'Staff', icon: UserCog, items: results?.staff ?? [] },
    { label: 'Branches', icon: Building2, items: results?.branches ?? [] },
  ].filter((group) => group.items.length > 0);

  const goTo = (href: string) => {
    notifyProgrammaticNavigation(href);
    router.push(href);
    setQuery('');
  };

  const hasResults = navMatches.length > 0 || groups.length > 0;

  return (
    <div className="relative hidden w-full max-w-sm md:block">
      <SearchBar
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder="Search members, staff, branches, pages…"
      />
      {focused && hasResults && (
        <div className="animate-in fade-in-0 zoom-in-95 duration-150 absolute z-50 mt-1.5 max-h-[70vh] w-full overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-md">
          {navMatches.length > 0 && (
            <div className="mb-1">
              <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">Pages</p>
              {navMatches.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onMouseDown={() => goTo(item.href)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {groups.map((group) => (
            <div key={group.label} className="mb-1 last:mb-0">
              <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={() => goTo(item.url)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="flex items-center gap-2 truncate">
                    <group.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                  </span>
                  {item.subtitle && <span className="shrink-0 text-xs text-muted-foreground">{item.subtitle}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
