'use client';

import * as React from 'react';

import { useGymInfo, useMemberMeasurements } from '../../hooks/use-member-portal';
import type { useDashboardData } from '../../hooks/use-dashboard-data';
import { MemberDashboardDetailModal, type MemberDashboardStatKind } from '../member-dashboard-detail-modal';
import { AttendanceCard, BillingCard, ClassesCard, MeasurementCard, MyDataCard, WorkoutCard, YourGymCard } from './dashboard-cards';
import { DashboardHero } from './dashboard-hero';
import { DashboardTiles } from './dashboard-tiles';

/** Dashboard body once data is ready (`data.overview`/`data.profile` are non-null here). */
export function DashboardCards({ data, exporting, onExport }: { data: ReturnType<typeof useDashboardData>; exporting: boolean; onExport: () => void }) {
  const { overview, profile } = data;
  const { data: measurements, isLoading: loadingMeasurements } = useMemberMeasurements();
  const { data: gym } = useGymInfo();
  const [openStat, setOpenStat] = React.useState<MemberDashboardStatKind | null>(null);
  if (!overview || !profile) return null;

  return (
    <div className="space-y-4 md:space-y-5">
      <DashboardHero overview={overview} qrUrl={profile.qrCodeImageUrl} />
      <DashboardTiles overview={overview} onOpen={setOpenStat} />
      <div className="grid gap-4 md:gap-5 lg:grid-cols-3">
        <AttendanceCard attendance={overview.attendance} />
        <ClassesCard classes={overview.classes} />
        <WorkoutCard workout={overview.workout} showWeek={!data.usingFallback} />
        <MeasurementCard measurements={measurements} loading={loadingMeasurements} />
        <BillingCard invoices={data.invoices} billing={overview.billing} loading={data.invoicesLoading} />
        <YourGymCard overview={overview} gym={gym} />
        <MyDataCard exporting={exporting} onExport={onExport} />
      </div>
      <MemberDashboardDetailModal
        kind={openStat}
        onClose={() => setOpenStat(null)}
        membership={profile.currentMembership}
        attendanceItems={data.attendanceItems}
        workout={data.workout}
        invoices={data.invoices}
      />
    </div>
  );
}
