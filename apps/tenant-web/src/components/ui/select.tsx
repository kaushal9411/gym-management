import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Marks the field invalid for styling + assistive technology. */
  invalid?: boolean;
}

/**
 * Native `<select>` — no design-system Select/Combobox exists anywhere in
 * this monorepo yet (no `@radix-ui/react-select`/`cmdk` dependency either),
 * so this mirrors `Input`'s exact visual chrome rather than pulling in a
 * new dependency for one dropdown. Native `<select>` also beats a custom
 * listbox for a "pick from N gyms" use case — free keyboard nav, screen
 * reader support, and mobile's native picker UI.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, 'aria-invalid': ariaInvalid, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={ariaInvalid ?? (invalid ? true : undefined)}
          className={cn(
            'flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-3.5 py-2 pr-9 text-sm shadow-xs transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40',
            'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
