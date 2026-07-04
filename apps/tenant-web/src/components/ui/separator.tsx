'use client';

import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';

import { cn } from '@/lib/utils';

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

/** Divider with centered label — “or continue with”. */
function LabelledDivider({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)} role="separator" aria-label={label}>
      <Separator className="flex-1" />
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <Separator className="flex-1" />
    </div>
  );
}

export { Separator, LabelledDivider };
