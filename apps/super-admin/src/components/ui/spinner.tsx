import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  /** Accessible loading description announced to screen readers. */
  label?: string;
}

function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      <Loader2 aria-hidden className={cn('size-4 animate-spin', className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export { Spinner };
