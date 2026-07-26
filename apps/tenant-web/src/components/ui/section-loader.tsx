import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface SectionLoaderProps {
  label?: string;
  className?: string;
}

/** A small inline loader for one card/section/panel — the least intrusive of the three loader tiers (Full Screen > Page > Section). */
export function SectionLoader({ label = 'Loading…', className }: SectionLoaderProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground', className)}>
      <Spinner label={label} />
      {label}
    </div>
  );
}
