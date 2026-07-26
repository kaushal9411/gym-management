import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  label?: string;
  className?: string;
}

/** Fills the content area (not the whole viewport) — for a route/page-level loading boundary, e.g. an App Router `loading.tsx`. */
export function PageLoader({ label = 'Loading…', className }: PageLoaderProps) {
  return (
    <div className={cn('flex min-h-[40vh] flex-col items-center justify-center gap-3', className)}>
      <Spinner className="size-6" label={label} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
