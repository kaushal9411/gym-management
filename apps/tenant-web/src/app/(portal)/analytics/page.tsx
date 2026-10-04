'use client';

import * as React from 'react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { AnalyticsContent } from '@/features/reports/components/analytics/analytics-content';
import { SkeletonBlock } from '@/features/reports/components/ui';

export default function AnalyticsPage() {
  const { hasPermission } = usePermissions();
  if (!hasPermission('analytics:view')) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have access to analytics.</p>;
  }
  // `useSearchParams` (the `?view=` tab) needs a Suspense boundary for static prerendering.
  return (
    <React.Suspense fallback={<SkeletonBlock height={320} />}>
      <AnalyticsContent />
    </React.Suspense>
  );
}
