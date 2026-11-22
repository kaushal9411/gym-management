'use client';

import * as React from 'react';
import { CalendarCheck, CalendarRange, Dumbbell, Flame, Salad, Wallet } from 'lucide-react';

import { formatDate, parseMoney, plural, usePortalMoney } from '../../lib/format';
import type { MemberOverview } from '../../services/member-portal.service';
import type { MemberDashboardStatKind } from '../member-dashboard-detail-modal';
import { StaggerGroup } from '../kit';
import { StatTile } from '../kit/stat-tile';

/** Six animated KPI tiles (membership / visits / streak / workout / diet-or-total / outstanding). Membership, visits, workout and outstanding open the detail modal. */
/** Static class names (Tailwind must see them): tile count -> grid columns, so a smaller set still fills its rows. */
const GRID_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1 xl:grid-cols-1',
  2: 'lg:grid-cols-2 xl:grid-cols-2',
  3: 'lg:grid-cols-3 xl:grid-cols-3',
  4: 'lg:grid-cols-4 xl:grid-cols-4',
  5: 'lg:grid-cols-5 xl:grid-cols-5',
  6: 'lg:grid-cols-3 xl:grid-cols-6',
};

export function DashboardTiles({ overview, onOpen, has }: { overview: MemberOverview; onOpen: (k: MemberDashboardStatKind) => void; has: (flag: string) => boolean }) {
  const money = usePortalMoney();
  const { membership, attendance, workout, diet, billing } = overview;
  const outstanding = parseMoney(billing.outstanding.value);
  const attendanceOn = has('attendance');
  const workoutOn = has('workout_plans');
  const paymentsOn = has('payments');
  const dietTile = has('diet_plans') && diet ? diet : null;
  const msTone = !membership ? 'muted' : membership.expired ? 'danger' : membership.daysLeft <= 7 ? 'warning' : 'violet';

  // Each tile belongs to a module; a tile whose module is off is dropped (never shown as 0) and the grid reflows.
  const tiles: Array<{ key: string; node: (className: string | undefined) => React.ReactNode } | null> = [
    {
      key: 'membership',
      node: (className) => (
        <StatTile
          className={className}
          label="Membership"
          icon={CalendarRange}
          tone={msTone}
          value={!membership ? 'None' : membership.expired ? 'Expired' : membership.daysLeft}
          format={(n) => `${Math.round(n)}d left`}
          hint={membership ? `${membership.expired ? 'Ended' : 'Ends'} ${formatDate(membership.endDate, { day: 'numeric', month: 'short' })}` : 'Talk to the front desk'}
          progress={membership && membership.totalDays ? Math.max(0, (membership.daysLeft / membership.totalDays) * 100) : null}
          onClick={() => onOpen('membership')}
        />
      ),
    },
    !attendanceOn
      ? null
      : {
          key: 'visits',
          node: (className) => (
            <StatTile
              className={className}
              label="Visits this month"
              icon={CalendarCheck}
              tone="info"
              value={attendance.thisMonth.visits}
              hint={`vs ${attendance.thisMonth.previous} last month`}
              delta={{ current: attendance.thisMonth.visits, previous: attendance.thisMonth.previous }}
              onClick={() => onOpen('attendance')}
            />
          ),
        },
    !attendanceOn
      ? null
      : {
          key: 'streak',
          node: (className) => <StatTile className={className} label="Current streak" icon={Flame} tone="orange" value={attendance.currentStreakDays} format={(n) => `${Math.round(n)}d`} hint={`Best ${plural(attendance.bestStreakDays, 'day')}`} />,
        },
    !workoutOn
      ? null
      : {
          key: 'workout',
          node: (className) => (
            <StatTile
              className={className}
              label="Workout progress"
              icon={Dumbbell}
              tone="orange"
              value={workout ? workout.progressPercent : '—'}
              format={(n) => `${Math.round(n)}%`}
              hint={workout ? `${workout.completedExercises}/${workout.totalExercises} exercises` : 'No plan assigned'}
              progress={workout ? workout.progressPercent : null}
              onClick={() => onOpen('workout')}
            />
          ),
        },
    dietTile
      ? {
          key: 'diet',
          node: (className) => (
            <StatTile
              className={className}
              label="Diet today"
              icon={Salad}
              tone={dietTile.loggedToday ? 'success' : 'warning'}
              value={dietTile.loggedToday ? 'Logged' : 'Not yet'}
              hint={dietTile.waterTodayMl != null ? `${dietTile.waterTodayMl} ml water` : dietTile.dailyCalories ? `${dietTile.dailyCalories} kcal plan` : dietTile.planName}
              href="/portal/diet"
            />
          ),
        }
      : !attendanceOn
        ? null
        : {
            key: 'total-visits',
            node: (className) => <StatTile className={className} label="Total visits" icon={CalendarCheck} tone="success" value={attendance.totalVisits} hint="All time" onClick={() => onOpen('attendance')} />,
          },
    !paymentsOn
      ? null
      : {
          key: 'outstanding',
          node: (className) => (
            <StatTile
              className={className}
              label="Outstanding"
              icon={Wallet}
              tone={outstanding > 0 ? 'warning' : 'success'}
              value={outstanding > 0 ? outstanding : 'All paid'}
              format={(n) => money.format(n)}
              hint={outstanding > 0 ? `${plural(billing.outstanding.invoiceCount, 'invoice')}${billing.nextDueDate ? ` · due ${formatDate(billing.nextDueDate, { day: 'numeric', month: 'short' })}` : ''}` : 'Nothing due'}
              onClick={() => onOpen('outstanding')}
            />
          ),
        },
  ];
  const shown = tiles.filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <StaggerGroup step={0.05} className={`grid grid-cols-2 gap-3 ${GRID_COLS[shown.length] ?? GRID_COLS[6]}`}>
      {shown.map((t, i) => (
        <React.Fragment key={t.key}>{t.node(shown.length % 2 === 1 && i === shown.length - 1 ? 'col-span-2 lg:col-span-1' : undefined)}</React.Fragment>
      ))}
    </StaggerGroup>
  );
}
