'use client';

import { CalendarCheck, CalendarRange, Dumbbell, Flame, Salad, Wallet } from 'lucide-react';

import { formatDate, parseMoney, plural, usePortalMoney } from '../../lib/format';
import type { MemberOverview } from '../../services/member-portal.service';
import type { MemberDashboardStatKind } from '../member-dashboard-detail-modal';
import { StaggerGroup } from '../kit';
import { StatTile } from '../kit/stat-tile';

/** Six animated KPI tiles (membership / visits / streak / workout / diet-or-total / outstanding). Membership, visits, workout and outstanding open the detail modal. */
export function DashboardTiles({ overview, onOpen }: { overview: MemberOverview; onOpen: (k: MemberDashboardStatKind) => void }) {
  const money = usePortalMoney();
  const { membership, attendance, workout, diet, billing } = overview;
  const outstanding = parseMoney(billing.outstanding.value);
  const msTone = !membership ? 'muted' : membership.expired ? 'danger' : membership.daysLeft <= 7 ? 'warning' : 'violet';

  return (
    <StaggerGroup step={0.05} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <StatTile
        label="Membership"
        icon={CalendarRange}
        tone={msTone}
        value={!membership ? 'None' : membership.expired ? 'Expired' : membership.daysLeft}
        format={(n) => `${Math.round(n)}d left`}
        hint={membership ? `${membership.expired ? 'Ended' : 'Ends'} ${formatDate(membership.endDate, { day: 'numeric', month: 'short' })}` : 'Talk to the front desk'}
        progress={membership && membership.totalDays ? Math.max(0, (membership.daysLeft / membership.totalDays) * 100) : null}
        onClick={() => onOpen('membership')}
      />
      <StatTile
        label="Visits this month"
        icon={CalendarCheck}
        tone="info"
        value={attendance.thisMonth.visits}
        hint={`vs ${attendance.thisMonth.previous} last month`}
        delta={{ current: attendance.thisMonth.visits, previous: attendance.thisMonth.previous }}
        onClick={() => onOpen('attendance')}
      />
      <StatTile label="Current streak" icon={Flame} tone="orange" value={attendance.currentStreakDays} format={(n) => `${Math.round(n)}d`} hint={`Best ${plural(attendance.bestStreakDays, 'day')}`} />
      <StatTile
        label="Workout progress"
        icon={Dumbbell}
        tone="orange"
        value={workout ? workout.progressPercent : '—'}
        format={(n) => `${Math.round(n)}%`}
        hint={workout ? `${workout.completedExercises}/${workout.totalExercises} exercises` : 'No plan assigned'}
        progress={workout ? workout.progressPercent : null}
        onClick={() => onOpen('workout')}
      />
      {diet ? (
        <StatTile
          label="Diet today"
          icon={Salad}
          tone={diet.loggedToday ? 'success' : 'warning'}
          value={diet.loggedToday ? 'Logged' : 'Not yet'}
          hint={diet.waterTodayMl != null ? `${diet.waterTodayMl} ml water` : diet.dailyCalories ? `${diet.dailyCalories} kcal plan` : diet.planName}
          href="/portal/diet"
        />
      ) : (
        <StatTile label="Total visits" icon={CalendarCheck} tone="success" value={attendance.totalVisits} hint="All time" onClick={() => onOpen('attendance')} />
      )}
      <StatTile
        label="Outstanding"
        icon={Wallet}
        tone={outstanding > 0 ? 'warning' : 'success'}
        value={outstanding > 0 ? outstanding : 'All paid'}
        format={(n) => money.format(n)}
        hint={outstanding > 0 ? `${plural(billing.outstanding.invoiceCount, 'invoice')}${billing.nextDueDate ? ` · due ${formatDate(billing.nextDueDate, { day: 'numeric', month: 'short' })}` : ''}` : 'Nothing due'}
        onClick={() => onOpen('outstanding')}
      />
    </StaggerGroup>
  );
}
