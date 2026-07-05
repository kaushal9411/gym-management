import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 px-6 text-center', className)}
      {...props}
    >
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
