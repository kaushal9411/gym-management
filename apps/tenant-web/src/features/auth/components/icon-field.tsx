'use client';

import * as React from 'react';
import { Check, type LucideIcon } from 'lucide-react';

import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface IconFieldProps extends InputProps {
  icon: LucideIcon;
  /** Shows a trailing emerald check once the field reads as valid — purely cosmetic, never gates submission. */
  showSuccess?: boolean;
  /** Override the icon's idle/focus color classes — for use on a fixed-dark surface where the default muted-foreground token would be invisible. */
  iconClassName?: string;
  /** Focus-glow ring color — defaults to the brand primary; pass a fixed color to match a non-theme-reactive surface. */
  glowClassName?: string;
}

/**
 * Login-page-only input wrapper: leading icon + focus glow + an optional
 * trailing success check. Composes the existing `Input` (unmodified) rather
 * than changing its shared API, so no other page is affected.
 */
export const IconField = React.forwardRef<HTMLInputElement, IconFieldProps>(
  ({ icon: Icon, showSuccess, invalid, className, iconClassName, glowClassName, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false);

    return (
      <div
        className={cn(
          'group relative rounded-lg transition-shadow duration-200',
          focused && !invalid && (glowClassName ?? 'shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]'),
        )}
      >
        <Icon
          className={cn(
            'pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200',
            iconClassName ?? 'text-muted-foreground/60',
            focused && !invalid && (iconClassName ? '' : 'text-primary'),
          )}
          aria-hidden
        />
        <Input
          ref={ref}
          invalid={invalid}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={cn('h-12 pl-11 text-[15px]', showSuccess && !invalid && 'pr-10', className)}
          {...props}
        />
        {showSuccess && !invalid ? (
          <span className="absolute right-3.5 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-success">
            <Check className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
    );
  },
);
IconField.displayName = 'IconField';
