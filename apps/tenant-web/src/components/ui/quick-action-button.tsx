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
        'group flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4 text-center shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  ),
);
QuickActionButton.displayName = 'QuickActionButton';

export { QuickActionButton };
