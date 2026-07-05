'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlags, useSetFeatureFlag } from '@/features/feature-flags/hooks/use-feature-flags';
import type { FeatureFlag } from '@/features/feature-flags/types';
import { cn } from '@/lib/utils';

function groupByCategory(flags: FeatureFlag[]): Record<string, FeatureFlag[]> {
  return flags.reduce<Record<string, FeatureFlag[]>>((acc, flag) => {
    const category = flag.category ?? 'other';
    acc[category] ??= [];
    acc[category].push(flag);
    return acc;
  }, {});
}

export default function FeatureFlagsPage() {
  const { data: flags, isLoading } = useFeatureFlags();
  const setFlag = useSetFeatureFlag();

  if (isLoading || !flags) return <Skeleton className="h-96 rounded-xl" />;

  const grouped = groupByCategory(flags);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feature Flags</h1>
        <p className="text-muted-foreground">Enable or disable modules globally, across every tenant.</p>
      </div>

      {Object.entries(grouped).map(([category, categoryFlags]) => (
        <Card key={category}>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold capitalize">{category}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {categoryFlags.map((flag) => (
                <button
                  key={flag.key}
                  onClick={() => setFlag.mutate({ key: flag.key, enabled: !flag.enabled })}
                  className={cn(
                    'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    flag.enabled ? 'border-success/30 bg-success/5' : 'border-input',
                  )}
                >
                  <span>{flag.label}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', flag.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                    {flag.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
