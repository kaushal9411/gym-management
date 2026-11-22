'use client';

import * as React from 'react';

import { useGymInfo, useMemberMeasurements } from '../../hooks/use-member-portal';
import type { useDashboardData } from '../../hooks/use-dashboard-data';
import { MemberDashboardDetailModal, type MemberDashboardStatKind } from '../member-dashboard-detail-modal';
import { AttendanceCard, BillingCard, ClassesCard, MeasurementCard, MyDataCard, WorkoutCard, YourGymCard } from './dashboard-cards';
import { DashboardHero } from './dashboard-hero';
import { DashboardTiles } from './dashboard-tiles';
import { PlanBenefitsSection } from '../plan/plan-benefits-card';

/** Static class names (Tailwind must see them): a card's width on `lg` in the 3-column grid. */
const LG_SPAN = { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3' } as const;

interface DashboardCardSlot {
  key: string;
  span: 1 | 2 | 3;
  node: React.ReactNode;
}

/** Dashboard body once data is ready (`data.overview`/`data.profile` are non-null here). */
export function DashboardCards({ data, exporting, onExport }: { data: ReturnType<typeof useDashboardData>; exporting: boolean; onExport: () => void }) {
  const { overview, profile, has } = data;
  const { data: measurements, isLoading: loadingMeasurements } = useMemberMeasurements();
  const { data: gym } = useGymInfo();
  const [openStat, setOpenStat] = React.useState<MemberDashboardStatKind | null>(null);
  if (!overview || !profile) return null;

  // Sections of modules that are off are not rendered (no zeros / false empty states); the last card stretches so the final row has no hole.
  const slots: Array<DashboardCardSlot | null> = [
    has('attendance') ? { key: 'attendance', span: 2, node: <AttendanceCard attendance={overview.attendance} /> } : null,
    has('live_classes') ? { key: 'classes', span: 1, node: <ClassesCard classes={overview.classes} /> } : null,
    has('workout_plans') ? { key: 'workout', span: 1, node: <WorkoutCard workout={overview.workout} showWeek={!data.usingFallback} /> } : null,
    { key: 'measurements', span: 1, node: <MeasurementCard measurements={measurements} loading={loadingMeasurements} /> },
    has('payments') ? { key: 'billing', span: 1, node: <BillingCard invoices={data.invoices} billing={overview.billing} loading={data.invoicesLoading} /> } : null,
    { key: 'gym', span: 1, node: <YourGymCard overview={overview} gym={gym} /> },
    { key: 'data', span: 3, node: <MyDataCard exporting={exporting} onExport={onExport} /> },
  ];
  const cards = slots.filter((c): c is DashboardCardSlot => c !== null);
  // Fill the last partial row before the full-width "My data" card by widening the card just before it.
  const rowSum = cards.slice(0, -1).reduce((n, c) => n + c.span, 0) % 3;
  const fillIndex = cards.length - 2;
  if (rowSum !== 0 && fillIndex >= 0) cards[fillIndex] = { ...cards[fillIndex]!, span: (cards[fillIndex]!.span + (3 - rowSum)) as 1 | 2 | 3 };

  return (
    <div className="space-y-4 md:space-y-5">
      <DashboardHero overview={overview} qrUrl={profile.qrCodeImageUrl} has={has} />
      <DashboardTiles overview={overview} onOpen={setOpenStat} has={has} />
      {overview.membership ? <PlanBenefitsSection /> : null}
      <div className="grid gap-4 md:gap-5 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className={`min-w-0 [&>*]:h-full ${LG_SPAN[c.span]}`}>
            {c.node}
          </div>
        ))}
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
