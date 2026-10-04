'use client';

import * as React from 'react';
import { Activity, Building2, CalendarRange, Clock, Dumbbell, Globe, Mail, MapPin, Phone, Receipt, Ruler, ShieldCheck, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { BodyMeasurement } from '@/features/measurements/types';
import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { formatDate, formatDay, formatTime, parseMoney, usePortalMoney } from '../../lib/format';
import type { MemberGymInfo, MemberOverview, MemberPortalInvoice } from '../../services/member-portal.service';
import { EmptyBlock } from '../kit/empty-block';
import { PortalHeatmap, WeekdayBars } from '../kit/heatmap';
import { ListRow, PortalList, StatusChip } from '../kit/list';
import { ProgressRing } from '../kit/progress-ring';
import { SectionCard } from '../kit/section-card';
import { SkeletonCard } from '../kit/skeleton-card';
import { PayInvoiceButton } from '../pay-invoice-button';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 12-week heatmap + weekday bars (busiest day named). */
export function AttendanceCard({ attendance }: { attendance: MemberOverview['attendance'] }) {
  const points = attendance.daily.map((d) => ({ date: d.date, value: d.visits }));
  const monFirst = [1, 2, 3, 4, 5, 6, 0].map((w) => attendance.weekday.find((x) => x.weekday === w)?.count ?? 0);
  const max = Math.max(...monFirst);
  const busiest = max > 0 ? DAYS[[1, 2, 3, 4, 5, 6, 0][monFirst.indexOf(max)]!] : null;
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <SectionCard title="Attendance" subtitle={`${total} ${total === 1 ? 'visit' : 'visits'} in the last 12 weeks`} icon={Activity} tone="info" action={{ label: 'History', href: MEMBER_PORTAL_ROUTES.attendance }} className="lg:col-span-2">
      {total === 0 ? (
        <EmptyBlock compact icon={Activity} title="No visits in the last 12 weeks" description="Check in at the gym and your streak starts here." />
      ) : (
        <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
          <PortalHeatmap points={points} tone="info" />
          <div>
            <WeekdayBars values={monFirst} tone="info" />
            {busiest ? <p className="mt-2 text-xs text-muted-foreground">Busiest day: <span className="font-semibold text-foreground">{busiest}</span></p> : null}
          </div>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
        <Mini label="Best streak" value={`${attendance.bestStreakDays}d`} />
        <Mini label="Avg visit" value={attendance.avgVisitMinutes != null ? `${attendance.avgVisitMinutes} min` : null} />
        <Mini label="Last visit" value={attendance.lastVisitAt ? formatDay(attendance.lastVisitAt.slice(0, 10)) : null} />
      </div>
    </SectionCard>
  );
}

function Mini({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold tabular-nums">{value ?? '—'}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function ClassesCard({ classes }: { classes: MemberOverview['classes'] }) {
  return (
    <SectionCard title="Upcoming classes" subtitle="Your next bookings" icon={CalendarRange} tone="violet" action={{ label: 'Book', href: MEMBER_PORTAL_ROUTES.classes }} flush>
      {classes.upcoming.length === 0 ? (
        <EmptyBlock compact icon={CalendarRange} title="Nothing booked" description="Book a class for the week ahead." />
      ) : (
        <PortalList>
          {classes.upcoming.slice(0, 3).map((c) => (
            <ListRow
              key={c.sessionId}
              icon={CalendarRange}
              tone="violet"
              title={c.name}
              subtitle={`${formatDay(c.date)} · ${formatTime(c.startTime)}–${formatTime(c.endTime)}${c.trainerName ? ` · ${c.trainerName}` : ''}`}
              trailing={<StatusChip tone="success">{c.bookingStatus === 'BOOKED' ? 'Booked' : c.bookingStatus}</StatusChip>}
              href={MEMBER_PORTAL_ROUTES.classes}
              hideChevron
            />
          ))}
        </PortalList>
      )}
    </SectionCard>
  );
}

export function WorkoutCard({ workout, showWeek }: { workout: NonNullable<MemberOverview['workout']> | null; showWeek: boolean }) {
  return (
    <SectionCard title="Workout" subtitle={workout?.planName ?? 'No plan assigned'} icon={Dumbbell} tone="orange" action={{ label: 'Open', href: MEMBER_PORTAL_ROUTES.workout }}>
      {!workout ? (
        <EmptyBlock compact icon={Dumbbell} title="No workout plan" description="Ask your trainer to assign you one." />
      ) : (
        <div className="flex items-center gap-4">
          <ProgressRing value={workout.progressPercent} size={84} tone="orange">
            <span className="text-lg font-bold tabular-nums">{workout.progressPercent}%</span>
          </ProgressRing>
          <div className="min-w-0 space-y-1 text-sm">
            <p>
              <span className="font-semibold tabular-nums">{workout.completedExercises}</span> of {workout.totalExercises} exercises done
            </p>
            {showWeek ? (
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{workout.completedThisWeek}</span> completed this week
              </p>
            ) : null}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function num(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function MeasurementCard({ measurements, loading }: { measurements: BodyMeasurement[] | undefined; loading: boolean }) {
  if (loading) return <SkeletonCard lines={2} />;
  const sorted = [...(measurements ?? [])].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const latest = sorted[0];
  const prev = sorted[1];
  const metrics = latest
    ? ([
        { label: 'Weight', unit: 'kg', cur: num(latest.weightKg), prev: num(prev?.weightKg) },
        { label: 'Body fat', unit: '%', cur: num(latest.bodyFatPercent), prev: num(prev?.bodyFatPercent) },
        { label: 'Waist', unit: 'cm', cur: num(latest.waistCm), prev: num(prev?.waistCm) },
      ] as const).filter((m) => m.cur !== null)
    : [];
  return (
    <SectionCard title="Body snapshot" subtitle={latest ? `Recorded ${formatDate(latest.recordedAt)}` : 'No measurements yet'} icon={Ruler} tone="success" action={{ label: 'All', href: MEMBER_PORTAL_ROUTES.measurements }}>
      {metrics.length === 0 ? (
        <EmptyBlock compact icon={Ruler} title="No measurements yet" description="Your trainer records these during check-ups." />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m) => {
            const diff = m.prev != null && m.cur != null ? Math.round((m.cur - m.prev) * 10) / 10 : null;
            return (
              <div key={m.label} className="min-w-0 rounded-xl bg-muted/60 p-2.5 text-center">
                <p className="truncate text-lg font-semibold tabular-nums">
                  {m.cur}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">{m.unit}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{m.label}</p>
                {diff !== null && diff !== 0 ? <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{diff > 0 ? '+' : ''}{diff}{m.unit}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

const INVOICE_TONE: Record<string, 'success' | 'danger' | 'warning'> = { PAID: 'success', OVERDUE: 'danger' };

export function BillingCard({ invoices, billing, loading }: { invoices: MemberPortalInvoice[]; billing: MemberOverview['billing']; loading: boolean }) {
  const money = usePortalMoney();
  if (loading) return <SkeletonCard lines={3} />;
  const unpaid = invoices.find((i) => i.status !== 'PAID');
  const paid90 = parseMoney(billing.paidLast90Days.value);
  return (
    <SectionCard title="Recent invoices" subtitle={paid90 > 0 ? `${money.format(paid90)} paid in the last 90 days` : undefined} icon={Receipt} tone="warning" action={{ label: 'All', href: MEMBER_PORTAL_ROUTES.invoices }} flush>
      {invoices.length === 0 ? (
        <EmptyBlock compact icon={Receipt} title="No invoices yet" description="Your invoices will show up here once you're billed." />
      ) : (
        <>
          <PortalList>
            {invoices.slice(0, 4).map((inv) => (
              <ListRow
                key={inv.id}
                icon={Receipt}
                tone={INVOICE_TONE[inv.status] ?? 'warning'}
                title={inv.invoiceNumber}
                subtitle={`${formatDate(inv.invoiceDate)} · ${money.format(inv.totalAmount)}`}
                trailing={<StatusChip tone={INVOICE_TONE[inv.status] ?? 'warning'}>{inv.status.replace('_', ' ')}</StatusChip>}
                href={MEMBER_PORTAL_ROUTES.invoices}
                hideChevron
              />
            ))}
          </PortalList>
          {unpaid ? (
            <div className="flex items-center justify-between gap-3 border-t bg-warning/10 px-4 py-3">
              <p className="min-w-0 truncate text-xs">
                <span className="font-semibold">{unpaid.invoiceNumber}</span> · {money.format(unpaid.totalAmount)} due {formatDate(unpaid.dueDate)}
              </p>
              <PayInvoiceButton invoiceId={unpaid.id} invoiceNumber={unpaid.invoiceNumber} />
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

/** Trainer / branch / membership-since facts - only fields that exist. */
export function YourGymCard({ overview, gym }: { overview: MemberOverview; gym: MemberGymInfo | undefined }) {
  const { member } = overview;
  const today = DAYS[new Date().getDay()]!.toLowerCase();
  const hours = gym?.branch?.businessHours ?? gym?.businessHours ?? null;
  const todayHours = hours?.find((h) => h.day.toLowerCase() === today);
  const addr = gym?.branch?.address ?? gym?.address ?? null;
  const addrText = addr ? [addr.line1, addr.city, addr.state].filter(Boolean).join(', ') : '';
  const phone = gym?.branch?.phone ?? gym?.phone;
  const email = gym?.branch?.email ?? gym?.email;
  return (
    <SectionCard title={gym?.name ?? 'Your gym'} subtitle={member.branch?.name} icon={Building2} tone="primary" flush>
      <PortalList>
        {member.trainer ? <ListRow icon={UserRound} title={member.trainer.name} subtitle="Your trainer" /> : null}
        {member.branch ? <ListRow icon={Building2} title={member.branch.name} subtitle="Your branch" /> : null}
        <ListRow icon={ShieldCheck} title={formatDate(member.joiningDate)} subtitle="Member since" />
        {todayHours ? <ListRow icon={Clock} title={todayHours.closed ? 'Closed today' : `${formatTime(todayHours.open)} – ${formatTime(todayHours.close)}`} subtitle="Today's hours" /> : null}
        {addrText ? <ListRow icon={MapPin} title={addrText} subtitle="Address" /> : null}
        {phone ? <ListRow icon={Phone} title={phone} subtitle="Call the front desk" href={`tel:${phone}`} /> : null}
        {email ? <ListRow icon={Mail} title={email} subtitle="Email" href={`mailto:${email}`} /> : null}
        {gym?.website ? <ListRow icon={Globe} title={gym.website.replace(/^https?:\/\//, '')} subtitle="Website" href={gym.website} /> : null}
      </PortalList>
    </SectionCard>
  );
}

/** GDPR export - behaviour and copy preserved from the original dashboard. */
export function MyDataCard({ exporting, onExport }: { exporting: boolean; onExport: () => void }) {
  return (
    <SectionCard title="My data" icon={ShieldCheck} tone="muted" className="lg:col-span-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Download everything on file for you — profile, attendance, plans, invoices, and bookings — as a JSON file.</p>
        <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" disabled={exporting} onClick={onExport}>
          {exporting ? 'Preparing…' : 'Download my data'}
        </Button>
      </div>
    </SectionCard>
  );
}
