import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface QuickActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
}

const QuickActionButton = React.forwardRef<HTMLButtonElement, QuickActionButtonProps>(
  ({ icon: Icon, label, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  ),
);
QuickActionButton.displayName = 'QuickActionButton';

export { QuickActionButton };
