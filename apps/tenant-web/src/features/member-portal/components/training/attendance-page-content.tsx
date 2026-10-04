'use client';

import * as React from 'react';
import { CalendarCheck, CalendarDays, Clock, Flame, LogIn, Timer, Trophy } from 'lucide-react';

import { useMemberAttendance, useMemberOverview } from '../../hooks/use-member-portal';
import type { MemberPortalAttendanceItem } from '../../services/member-portal.service';
import { formatDate, formatDay } from '../../lib/format';
import { EmptyBlock, ListRow, PortalHeatmap, PortalHero, PortalList, SectionCard, SkeletonCard, SkeletonHero, StaggerGroup, StatTile, StatusChip, WeekdayBars, HeroChip } from '../kit';
import { FilterChips } from './chips';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PAGE = 30;
const MAX = 100; // API limit

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const minutesOf = (a: MemberPortalAttendanceItem) => (a.checkOutTime ? Math.max(0, Math.round((new Date(a.checkOutTime).getTime() - new Date(a.checkInTime).getTime()) / 60000)) : null);
const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);
const pretty = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const monthKey = (iso: string) => iso.slice(0, 7);

export function AttendancePageContent() {
  const [limit, setLimit] = React.useState(PAGE);
  const [month, setMonth] = React.useState('all');
  const { data, isLoading, isFetching } = useMemberAttendance(1, limit);
  const { data: overview } = useMemberOverview();
  const att = overview?.attendance;

  const items = React.useMemo(() => data?.items ?? [], [data]);
  const months = React.useMemo(() => {
    const set = Array.from(new Set(items.map((i) => monthKey(i.attendanceDate)))).sort().reverse().slice(0, 6);
    return set.map((k) => ({ value: k, label: new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) }));
  }, [items]);
  const filtered = month === 'all' ? items : items.filter((i) => monthKey(i.attendanceDate) === month);
  const groups = React.useMemo(() => {
    const map = new Map<string, MemberPortalAttendanceItem[]>();
    filtered.forEach((i) => {
      const k = i.attendanceDate.slice(0, 10);
      map.set(k, [...(map.get(k) ?? []), i]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const weekdayValues = React.useMemo(() => {
    const v = [0, 0, 0, 0, 0, 0, 0];
    att?.weekday.forEach((w) => {
      v[(w.weekday + 6) % 7] = w.count;
    });
    return v;
  }, [att]);
  const busiest = Math.max(...weekdayValues) > 0 ? weekdayValues.indexOf(Math.max(...weekdayValues)) : -1;
  const busiestName = busiest >= 0 ? DAYS[(busiest + 1) % 7] : null;
  const total = data?.total ?? 0;
  const canMore = items.length < total && limit < MAX;

  if (isLoading && !overview) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Attendance"
        title={att ? `${att.thisMonth.visits} ${att.thisMonth.visits === 1 ? 'visit' : 'visits'} this month` : 'My attendance'}
        subtitle={att?.lastVisitAt ? `Last visit ${formatDate(att.lastVisitAt)} at ${clock(att.lastVisitAt)}` : 'Your check-ins show up here'}
        chips={
          att ? (
            <>
              {att.thisMonth.visits !== att.thisMonth.previous ? (
                <HeroChip>
                  {att.thisMonth.visits > att.thisMonth.previous ? '▲' : '▼'} {Math.abs(att.thisMonth.visits - att.thisMonth.previous)} vs same point last month
                </HeroChip>
              ) : null}
              {att.avgVisitMinutes ? <HeroChip>~{att.avgVisitMinutes} min per visit</HeroChip> : null}
            </>
          ) : null
        }
        stats={att ? [{ label: 'Streak', value: att.currentStreakDays, format: (n) => `${n}d` }, { label: 'Best', value: att.bestStreakDays, format: (n) => `${n}d` }, { label: 'Total', value: att.totalVisits }] : undefined}
      />

      {att ? (
        <>
          <StaggerGroup className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="This month" value={att.thisMonth.visits} icon={CalendarCheck} tone="primary" delta={{ current: att.thisMonth.visits, previous: att.thisMonth.previous }} hint={`${att.thisMonth.previous} last month`} />
            <StatTile label="Current streak" value={att.currentStreakDays} format={(n) => `${n} day${n === 1 ? '' : 's'}`} icon={Flame} tone="orange" hint={`Best ${att.bestStreakDays} days`} progress={att.bestStreakDays ? (att.currentStreakDays / att.bestStreakDays) * 100 : 0} />
            <StatTile label="Avg visit" value={att.avgVisitMinutes ? dur(att.avgVisitMinutes) : '—'} icon={Timer} tone="info" hint="Check-in to check-out" />
            <StatTile label="Busiest day" value={busiestName ?? '—'} icon={Trophy} tone="violet" hint={busiest >= 0 ? `${weekdayValues[busiest]} visits` : 'No pattern yet'} />
          </StaggerGroup>

          <div className="grid gap-4 md:grid-cols-5">
            <SectionCard className="md:col-span-3" title="Last 12 weeks" subtitle="Darker = more visits" icon={CalendarDays} tone="primary">
              <PortalHeatmap points={att.daily.map((d) => ({ date: d.date, value: d.visits }))} weeks={12} />
            </SectionCard>
            <SectionCard className="md:col-span-2" title="By weekday" subtitle={busiestName ? `You train most on ${busiestName}s` : undefined} icon={Trophy} tone="violet">
              <WeekdayBars values={weekdayValues} tone="violet" />
            </SectionCard>
          </div>
        </>
      ) : null}

      <SectionCard title="Visit history" subtitle={total ? `${total} check-ins in total` : undefined} icon={LogIn} tone="success" flush>
        {items.length === 0 ? (
          <EmptyBlock icon={CalendarCheck} title="No visits yet" description="Your check-in history will show up here after your first visit." />
        ) : (
          <>
            {months.length > 1 ? (
              <div className="border-b px-4 py-3">
                <FilterChips label="Month" value={month} onChange={setMonth} options={[{ value: 'all', label: 'All' }, ...months]} />
              </div>
            ) : null}
            {groups.length === 0 ? (
              <EmptyBlock compact icon={CalendarDays} title="No visits in this month" />
            ) : (
              groups.map(([day, rows]) => (
                <div key={day}>
                  <p className="bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                    {formatDay(day)}
                    {formatDay(day) === 'Today' || formatDay(day) === 'Tomorrow' ? ` · ${formatDate(day)}` : ''}
                  </p>
                  <PortalList>
                    {rows.map((r) => {
                      const mins = minutesOf(r);
                      return (
                        <ListRow
                          key={r.id}
                          icon={r.checkOutTime ? Clock : LogIn}
                          tone={r.checkOutTime ? 'primary' : 'success'}
                          title={r.branch.name}
                          subtitle={`${clock(r.checkInTime)} → ${r.checkOutTime ? clock(r.checkOutTime) : 'in progress'}`}
                          trailing={
                            <span className="flex flex-col items-end gap-1">
                              <span className="flex gap-1">
                                {mins !== null ? <StatusChip tone="info">{dur(mins)}</StatusChip> : null}
                                {r.checkOutTime ? null : <StatusChip tone="success">Checked in</StatusChip>}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{pretty(r.method)}</span>
                            </span>
                          }
                        />
                      );
                    })}
                  </PortalList>
                </div>
              ))
            )}
            <div className="flex flex-col items-center gap-1 border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {items.length} of {total}
              </p>
              {canMore ? (
                <button type="button" disabled={isFetching} onClick={() => setLimit((l) => Math.min(MAX, l + PAGE))} className="min-h-11 rounded-xl border px-5 text-sm font-semibold transition active:scale-95 hover:bg-accent disabled:opacity-60">
                  {isFetching ? 'Loading…' : 'Load more'}
                </button>
              ) : items.length < total ? (
                <p className="text-xs text-muted-foreground">Showing your latest {MAX} visits.</p>
              ) : null}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
