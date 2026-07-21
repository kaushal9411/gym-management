'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useMemberList } from '@/features/members/hooks/use-members';
import type { MemberListItem } from '@/features/members/types';

interface MemberCheckinSearchProps {
  onSelect: (member: MemberListItem) => void;
  placeholder?: string;
}

/** Debounced "Manual Member Search" — search-as-you-type over the Member Management list, used by the Check-In/Check-Out manual flow. */
export function MemberCheckinSearch({ onSelect, placeholder }: MemberCheckinSearchProps) {
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemberList({ page: 1, limit: 8, search: debounced || undefined, status: 'ACTIVE' });
  const items = debounced.length >= 2 ? (results.data?.items ?? []) : [];

  return (
    <div className="relative max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={placeholder ?? 'Search member by name, email, or member ID…'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && debounced.length >= 2 ? (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {results.isPending ? (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No active members match &ldquo;{debounced}&rdquo;.</p>
          ) : (
            items.map((member) => (
              <button
                key={member.id}
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(member);
                  setQuery('');
                  setDebounced('');
                  setOpen(false);
                }}
              >
                <Avatar className="size-7">
                  {member.profilePhotoUrl ? <AvatarImage src={member.profilePhotoUrl} alt="" /> : null}
                  <AvatarFallback className="text-xs">
                    {member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>
                  <span className="block font-medium">{member.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {member.memberId} · {member.branch.name}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
