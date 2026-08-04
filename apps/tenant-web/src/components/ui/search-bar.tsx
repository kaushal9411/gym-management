'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  containerClassName?: string;
}

const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, containerClassName, placeholder = 'Search…', 'aria-label': ariaLabel, ...props }, ref) => (
    <div className={cn('relative flex w-full items-center', containerClassName)}>
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground/70 transition-colors" aria-hidden />
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        // Placeholder text alone isn't an accessible name (WCAG 4.1.2) — it
        // vanishes once typed and several screen readers never announce it
        // in the first place. Default to the placeholder's own text so
        // every call site gets a real label for free; callers with a more
        // specific placeholder ("Search members…") inherit a matching
        // label automatically, and can still override via `aria-label`.
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          'h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm shadow-xs outline-none transition-all duration-150 placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
SearchBar.displayName = 'SearchBar';

export { SearchBar };
