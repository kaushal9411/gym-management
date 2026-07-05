import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:mt-0.5',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive',
        success: 'border-success/40 bg-success/10 text-success [&>svg]:text-success',
        warning: 'border-warning/50 bg-warning/15 text-warning-foreground [&>svg]:text-warning-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('col-start-2 font-medium leading-tight', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('col-start-2 text-sm [&_p]:leading-relaxed', className)} {...props} />
  ),
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
