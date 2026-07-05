'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  containerClassName?: string;
}

const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, containerClassName, placeholder = 'Search…', ...props }, ref) => (
    <div className={cn('relative flex w-full items-center', containerClassName)}>
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn(
          'h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
SearchBar.displayName = 'SearchBar';

export { SearchBar };
