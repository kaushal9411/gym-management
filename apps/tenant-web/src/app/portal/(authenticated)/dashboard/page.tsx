'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { DashboardCards } from '@/features/member-portal/components/dashboard/dashboard-page-content';
import { SkeletonCard, SkeletonHero } from '@/features/member-portal/components/kit';
import { useDashboardData } from '@/features/member-portal/hooks/use-dashboard-data';
import { memberPortalService } from '@/features/member-portal/services/member-portal.service';

export default function MemberDashboardPage() {
  const data = useDashboardData();
  const [exporting, setExporting] = React.useState(false);

  if (data.loading || !data.profile || !data.overview) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} tile />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-2" />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const memberId = data.profile.memberId;
  const handleExport = async () => {
    setExporting(true);
    try {
      await memberPortalService.downloadGdprExport(memberId);
    } catch {
      toast.error('Could not download your data — please try again.');
    } finally {
      setExporting(false);
    }
  };

  return <DashboardCards data={data} exporting={exporting} onExport={handleExport} />;
}
