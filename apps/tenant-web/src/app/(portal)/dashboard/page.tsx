'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';
import { AnnouncementsWidget } from '@/features/dashboard/components/announcements-widget';
import { DashboardHero } from '@/features/dashboard/components/dashboard-hero';
import { BranchPanel, HealthPanel, PlanPanel, StaffPanel } from '@/features/dashboard/components/insight-panels';
import { KpiStrip } from '@/features/dashboard/components/kpi-strip';
import { ActivityPanel, ExpiringPanel, OutstandingPanel } from '@/features/dashboard/components/list-panels';
import { MembersPanel } from '@/features/dashboard/components/members-panel';
import { UpcomingBirthdays } from '@/features/dashboard/components/upcoming-birthdays';
import { type DashboardPanelKey, useDashboardPanels } from '@/features/dashboard/hooks/use-dashboard-modules';
import { OnboardingChecklistCard } from '@/features/onboarding-checklist/components/onboarding-checklist-card';

// Recharts is a large dependency — the four chart panels load as their own chunk instead of inflating the dashboard route's main bundle.
const chartLoading = () => <Skeleton className="h-[360px] w-full rounded-2xl" />;
const MoneyChartPanel = dynamic(() => import('@/features/dashboard/components/chart-panels').then((m) => m.MoneyChartPanel), { ssr: false, loading: chartLoading });
const AttendanceChartPanel = dynamic(() => import('@/features/dashboard/components/chart-panels').then((m) => m.AttendanceChartPanel), { ssr: false, loading: chartLoading });
const NewMembersChartPanel = dynamic(() => import('@/features/dashboard/components/chart-panels').then((m) => m.NewMembersChartPanel), { ssr: false, loading: chartLoading });

/** Tints the header of the legacy Card-based widgets (announcements, birthdays) to match the new panels. Full class names, so Tailwind can see them. */
const TINT_AMBER =
  '[&>div]:h-full [&>div]:overflow-hidden [&>div>div:first-child]:border-b [&>div>div:first-child]:bg-gradient-to-r [&>div>div:first-child]:from-amber-500/15 [&>div>div:first-child]:to-transparent [&>div>div:nth-child(2)]:pt-5';
const TINT_ROSE =
  '[&>div]:h-full [&>div]:overflow-hidden [&>div>div:first-child]:border-b [&>div>div:first-child]:bg-gradient-to-r [&>div>div:first-child]:from-rose-500/15 [&>div>div:first-child]:to-transparent [&>div>div:nth-child(2)]:pt-5';

/** Each grid cell hides itself when its panel renders nothing, so the grid never shows an empty slot. */
const CELL = 'min-w-0 empty:hidden';

/** Static class names (Tailwind must see them) for a panel's width on `lg` in the 12-column grid. */
const LG_SPAN: Record<number, string> = { 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6', 8: 'lg:col-span-8', 12: 'lg:col-span-12' };

interface PanelSlot {
  key: DashboardPanelKey;
  span: number;
  className?: string;
  node: React.ReactNode;
}

/**
 * The dashboard rows. A panel is only rendered when its module is on (see `useDashboardPanels`); when a row loses panels the rest
 * share the 12 columns equally, so disabling a module reflows the grid instead of leaving a hole.
 */
const ROWS: PanelSlot[][] = [
  [
    { key: 'money', span: 8, node: <MoneyChartPanel /> },
    { key: 'members', span: 4, node: <MembersPanel /> },
  ],
  [
    { key: 'attendance', span: 6, node: <AttendanceChartPanel /> },
    { key: 'newMembers', span: 6, node: <NewMembersChartPanel /> },
  ],
  [
    { key: 'expiring', span: 4, node: <ExpiringPanel /> },
    { key: 'outstanding', span: 4, node: <OutstandingPanel /> },
    { key: 'activity', span: 4, node: <ActivityPanel /> },
  ],
  [
    { key: 'branch', span: 5, node: <BranchPanel /> },
    { key: 'staff', span: 3, node: <StaffPanel /> },
    { key: 'health', span: 4, node: <HealthPanel /> },
  ],
  [
    { key: 'announcements', span: 4, className: TINT_AMBER, node: <AnnouncementsWidget /> },
    { key: 'birthdays', span: 4, className: TINT_ROSE, node: <UpcomingBirthdays /> },
    { key: 'plan', span: 4, node: <PlanPanel /> },
  ],
];

export default function DashboardPage() {
  const panels = useDashboardPanels();

  return (
    <div className="w-full space-y-5">
      <DashboardHero />
      <OnboardingChecklistCard />
      <KpiStrip />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {ROWS.map((row) => {
          const visible = row.filter((slot) => panels[slot.key]);
          const intact = visible.length === row.length;
          return visible.map((slot) => (
            <div key={slot.key} className={`${CELL} ${slot.className ?? ''} ${LG_SPAN[intact ? slot.span : 12 / visible.length]}`}>
              {slot.node}
            </div>
          ));
        })}
      </div>
    </div>
  );
}
