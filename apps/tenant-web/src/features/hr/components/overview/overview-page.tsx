'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, CalendarCheck, CalendarDays, CalendarOff, Clock, Fingerprint, Hourglass, Plane, Star, UserCheck, UserRound, Users, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { formatDay, formatMonth, formatRange } from '../../lib/dates';
import { leaveTypeColor, mix, TONES } from '../../lib/hr-palette';
import { compactInr } from '../../lib/money';
import { DAY_PART_SHORT, RUN_STATUS_LABEL, useHrAccess } from '../../lib/status';
import { useHrOverview } from '../../hooks/use-hr';
import { HeroButton, HrAvatar, HrEmpty, HrError, HrHero, HrKpi, HrPanel, RowsSkeleton, StaggerGroup, Reveal, AnimatedNumber } from '../ui/hr-ui';
import { TodayBar, TrendBars } from './trend-bars';

export function OverviewPage() {
  const access = useHrAccess();
  const router = useRouter();
  const q = useHrOverview({ enabled: access.view });
  const m = useMotionSafe();

  React.useEffect(() => {
    if (!access.view && access.anySelf) router.replace('/hr/me');
  }, [access.view, access.anySelf, router]);

  if (!access.view) return null;
  const d = q.data;
  const loading = q.isPending;
  const payroll = d?.payroll ?? null;

  return (
    <div className="space-y-3.5">
      <HrHero
        eyebrow="People & payroll"
        icon={BriefcaseBusiness}
        title="HR Management"
        subtitle="Attendance, leave approvals and payroll for your whole team - one calm place."
        stats={
          d
            ? [
                { label: 'Team members', value: <AnimatedNumber value={d.headcount} /> },
                { label: 'Checked in now', value: <AnimatedNumber value={d.today.checkedInNow} /> },
                { label: 'Waiting for approval', value: <AnimatedNumber value={d.pendingLeaves} /> },
              ]
            : undefined
        }
        actions={
          <>
            {access.leaveManage ? (
              <HeroButton href="/hr/leaves" solid>
                <CalendarDays className="size-4" aria-hidden /> Review leaves{d && d.pendingLeaves > 0 ? ` (${d.pendingLeaves})` : ''}
              </HeroButton>
            ) : null}
            <HeroButton href="/hr/attendance">
              <CalendarCheck className="size-4" aria-hidden /> Mark attendance
            </HeroButton>
            {access.payrollManage ? (
              <HeroButton href="/hr/payroll">
                <Wallet className="size-4" aria-hidden /> Payroll
              </HeroButton>
            ) : null}
            {access.anySelf ? (
              <HeroButton href="/hr/me">
                <UserRound className="size-4" aria-hidden /> My HR
              </HeroButton>
            ) : null}
          </>
        }
      />

      {q.isError ? (
        <HrError message={q.error.message} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <StaggerGroup className="grid grid-cols-2 gap-3 md:grid-cols-4" step={0.05}>
            <HrKpi label="Present" value={d?.today.present ?? 0} icon={UserCheck} color={TONES.present.color} loading={loading} hint="On time today" href="/hr/attendance" />
            <HrKpi label="Late" value={d?.today.late ?? 0} icon={Clock} color={TONES.late.color} loading={loading} hint="Checked in late" href="/hr/attendance" />
            <HrKpi label="Half day" value={d?.today.halfDay ?? 0} icon={TONES.half.icon} color={TONES.half.color} loading={loading} hint="Short days" href="/hr/attendance" />
            <HrKpi label="On leave" value={d?.today.onLeave ?? 0} icon={Plane} color={TONES.leave.color} loading={loading} hint="Approved leave" href={access.leaveManage ? '/hr/leaves' : undefined} />
            <HrKpi label="Absent" value={d?.today.absent ?? 0} icon={TONES.absent.icon} color={TONES.absent.color} loading={loading} hint="Shift over, no check-in" href="/hr/attendance" pulse={(d?.today.absent ?? 0) > 0} />
            <HrKpi label="Yet to check in" value={d?.today.yetToCheckIn ?? d?.today.notMarked ?? 0} icon={Fingerprint} color="var(--muted-foreground)" loading={loading} hint="Shift not over yet" href="/hr/attendance" />
            <HrKpi label="Pending approvals" value={d?.pendingLeaves ?? 0} icon={Hourglass} color={TONES.pending.color} loading={loading} hint="Leave requests" pulse={(d?.pendingLeaves ?? 0) > 0} href={access.leaveManage ? '/hr/leaves' : undefined} />
            {payroll ? (
              <HrKpi
                label={`Payroll ${formatMonth(payroll.month, true)}`}
                value={payroll.totalNet ?? 0}
                format={(n) => compactInr(n)}
                icon={Wallet}
                color={payroll.status === 'PAID' ? TONES.paid.color : payroll.status === 'NOT_GENERATED' ? 'var(--muted-foreground)' : 'var(--chart-5)'}
                loading={loading}
                hint={payroll.status === 'NOT_GENERATED' ? 'Not generated yet' : payroll.status === 'PAID' ? 'Fully paid' : `${RUN_STATUS_LABEL[payroll.status]} · ${payroll.unpaidPayslips ?? 0} unpaid`}
                href={payroll.runId ? `/hr/payroll/${payroll.runId}` : '/hr/payroll'}
              />
            ) : (
              <HrKpi label="Team size" value={d?.headcount ?? 0} icon={Users} color="var(--primary)" loading={loading} hint="Active employees" href="/hr/employees" />
            )}
          </StaggerGroup>

          <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Reveal>
              <HrPanel title="Last 7 days" subtitle="Attendance mix per day" icon={CalendarCheck} tone="var(--success)">
                {loading ? <RowsSkeleton rows={1} height={230} /> : d ? <TrendBars trend={d.trend} /> : null}
              </HrPanel>
            </Reveal>
            <div className="space-y-3.5">
              <Reveal delay={0.05}>
                <HrPanel title="Today at a glance" subtitle={d ? formatDay(d.date, 'long') : undefined} icon={Users} tone="var(--primary)">
                  {loading ? <RowsSkeleton rows={1} height={64} /> : d ? <TodayBar today={d.today} /> : null}
                </HrPanel>
              </Reveal>
              <Reveal delay={0.1}>
                <HrPanel title="Quick actions" icon={ArrowRight} tone="var(--chart-5)">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: '/hr/attendance', label: 'Mark attendance', icon: CalendarCheck, show: true, color: 'var(--success)' },
                      { href: '/hr/leaves', label: 'Apply on behalf', icon: CalendarDays, show: access.leaveManage, color: 'var(--chart-7)' },
                      { href: '/hr/employees', label: 'Employees', icon: Users, show: true, color: 'var(--primary)' },
                      { href: '/hr/payroll', label: 'Run payroll', icon: Wallet, show: access.payrollManage, color: 'var(--chart-5)' },
                      { href: '/hr/setup', label: 'Shifts & holidays', icon: Star, show: true, color: 'var(--chart-3)' },
                    ]
                      .filter((a) => a.show)
                      .map((a) => (
                        <Link
                          key={a.href + a.label}
                          href={a.href}
                          className="group flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-bold transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ backgroundImage: `linear-gradient(135deg, ${mix(a.color, 10)}, transparent)` }}
                        >
                          <a.icon className="size-4 shrink-0" style={{ color: a.color }} aria-hidden />
                          <span className="truncate">{a.label}</span>
                        </Link>
                      ))}
                  </div>
                </HrPanel>
              </Reveal>
            </div>
          </div>

          <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {access.leaveManage ? (
              <Reveal>
                <HrPanel title="Who is off soon" subtitle="Approved leave in the next 14 days" icon={Plane} tone="var(--chart-7)" action={<Link href="/hr/leaves" className="text-xs font-bold text-primary hover:underline">Team calendar</Link>}>
                  {loading ? (
                    <RowsSkeleton rows={2} height={64} />
                  ) : !d || d.upcomingLeaves.length === 0 ? (
                    <HrEmpty icon={CalendarOff} title="Everyone is in" description="No approved leave in the next two weeks." compact />
                  ) : (
                    <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1">
                      {d.upcomingLeaves.map((l, i) => {
                        const c = leaveTypeColor(l.leaveType.color, i);
                        return (
                          <motion.div
                            key={l.id}
                            initial={m.reduce ? false : { opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className={cn('w-[220px] shrink-0 snap-start rounded-2xl border p-3')}
                            style={{ backgroundImage: `linear-gradient(135deg, ${mix(c, 12)}, transparent)`, boxShadow: `inset 0 3px 0 ${c}` }}
                          >
                            <div className="flex items-center gap-2">
                              <HrAvatar name={l.employee.name} size={32} />
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-extrabold">{l.employee.name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{l.leaveType.name}</p>
                              </div>
                            </div>
                            <p className="mt-2 text-xs font-bold">{formatRange(l.startDate, l.endDate)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {l.days} day{l.days === 1 ? '' : 's'}
                              {l.dayPart !== 'FULL_DAY' ? ` · ${DAY_PART_SHORT[l.dayPart]}` : ''}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </HrPanel>
              </Reveal>
            ) : null}
            <Reveal delay={0.05}>
              <HrPanel title="Upcoming holidays" subtitle="Next 30 days" icon={Star} tone="var(--chart-3)" className={access.leaveManage ? '' : 'lg:col-span-2'}>
                {loading ? (
                  <RowsSkeleton rows={2} height={40} />
                ) : !d || d.upcomingHolidays.length === 0 ? (
                  <HrEmpty icon={Star} title="No holidays coming up" description="Add public holidays under Setup." compact />
                ) : (
                  <ul className="space-y-2">
                    {d.upcomingHolidays.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2 font-bold">
                          <Star className="size-4 shrink-0 text-[color:var(--chart-3)]" aria-hidden /> <span className="truncate">{h.name}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{formatDay(h.date, 'weekday')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </HrPanel>
            </Reveal>
          </div>
        </>
      )}
    </div>
  );
}
