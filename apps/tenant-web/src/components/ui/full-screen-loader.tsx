import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface FullScreenLoaderProps {
  label?: string;
  className?: string;
}

/** Covers the entire viewport — for the initial app load and hard full-page transitions. Pair with `useDelayedLoading` at the call site to avoid a flash on fast loads. */
export function FullScreenLoader({ label = 'Loading…', className }: FullScreenLoaderProps) {
  return (
    <div className={cn('fixed inset-0 z-200 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm', className)}>
      <Spinner className="size-8" label={label} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
