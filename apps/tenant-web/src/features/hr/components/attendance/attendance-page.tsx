'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck, CalendarRange, ChevronLeft, ChevronRight, Fingerprint, FileEdit, ListChecks, Search, Sparkles, Table2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { RequirePermission } from '@/features/auth/guards/require-permission';
import { SegmentedTabs } from '@/features/reports/components/ui';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';
import { addDays, currentMonth, formatDay, formatMinutes, formatMonth, formatTime, monthOf, todayYmd } from '../../lib/dates';
import { mix, TONES } from '../../lib/hr-palette';
import { DAY_STATUS_LABEL, DAY_STATUS_TONE, roleLabel, useHrAccess } from '../../lib/status';
import { toHrError, useBulkAttendance, useDayAttendance, useMonthlyGrid } from '../../hooks/use-hr';
import type { DayAttendanceResponse, DayStatus } from '../../types';
import { StatusLegend } from '../ui/attendance-calendar';
import { AnimatedNumber, FieldLabel, HrAvatar, HrEmpty, HrError, HrHero, HrPanel, HrTextArea, MonthStepper, Pill, RowsSkeleton, ToneChip } from '../ui/hr-ui';
import { MarkAttendanceForm } from './mark-attendance-form';

type View = 'day' | 'month';
type Item = DayAttendanceResponse['items'][number];

function SourceTag({ item }: { item: Item }) {
  const a = item.attendance;
  if (!a.source) return <span className="text-xs text-muted-foreground">--</span>;
  const Icon = a.source === 'SELF' ? Fingerprint : a.source === 'MANUAL' ? FileEdit : Sparkles;
  const label = a.source === 'SELF' ? 'Self' : a.source === 'MANUAL' ? 'Manual' : 'Leave';
  return (
    <span className="inline-flex flex-col items-start leading-tight">
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
        <Icon className="size-3" aria-hidden /> {label}
      </span>
      {a.markedBy ? <span className="mt-0.5 text-[10.5px] text-muted-foreground">by {a.markedBy.name}</span> : null}
    </span>
  );
}

function DateStepper({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayYmd();
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <div role="group" aria-label="Date" className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-xs">
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Input type="date" aria-label="Pick a date" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-8 w-[150px] border-0 bg-transparent px-2 text-center text-sm font-bold shadow-none" />
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Next day" onClick={() => onChange(addDays(date, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {date !== today ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(today)}>
          Today
        </Button>
      ) : null}
    </div>
  );
}

function BulkPanel({ date, items, onClose }: { date: string; items: Item[]; onClose: () => void }) {
  const bulk = useBulkAttendance();
  // Only people who still need a record: nothing recorded, and a normal working day for them.
  const candidates = items.filter((i) => !i.attendance.recorded && (i.attendance.status === 'NOT_MARKED' || i.attendance.status === 'ABSENT'));
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(candidates.map((c) => c.employee.userId)));
  const [remark, setRemark] = React.useState('');
  const [inTime, setInTime] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = async () => {
    if (remark.trim().length < 3) {
      setError('A shared remark of at least 3 characters is required.');
      return;
    }
    if (selected.size === 0) {
      setError('Select at least one employee.');
      return;
    }
    try {
      const res = await bulk.mutateAsync({
        date,
        remark: remark.trim(),
        entries: [...selected].map((userId) => ({ userId, status: 'PRESENT' as const, ...(inTime ? { checkInTime: inTime } : {}) })),
      });
      toast.success(`${res.updated} employee${res.updated === 1 ? '' : 's'} marked present for ${formatDay(date)}.`);
      onClose();
    } catch (e) {
      setError(toHrError(e).message);
      toast.error(toHrError(e).message);
    }
  };

  return (
    <HrPanel title="Mark everyone present" subtitle={`${formatDay(date, 'long')} · employees without a record`} icon={UserCheck} tone="var(--success)" action={<Button type="button" size="sm" variant="ghost" onClick={onClose}>Close</Button>}>
      {candidates.length === 0 ? (
        <HrEmpty icon={UserCheck} title="Nothing to mark" description="Every employee already has a record or is off today." compact />
      ) : (
        <div className="space-y-3">
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((c) => (
              <li key={c.employee.userId}>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-[13px] font-semibold has-[:checked]:bg-[color-mix(in_oklch,var(--success)_10%,transparent)]">
                  <input type="checkbox" className="size-4 accent-[var(--success)]" checked={selected.has(c.employee.userId)} onChange={() => toggle(c.employee.userId)} />
                  <HrAvatar name={c.employee.name} size={24} />
                  <span className="truncate">{c.employee.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div>
              <FieldLabel htmlFor="bulk-remark" required>Shared remark</FieldLabel>
              <HrTextArea id="bulk-remark" value={remark} onChange={(e) => { setRemark(e.target.value); setError(null); }} maxLength={300} placeholder="e.g. Bulk mark - biometric was down" className="min-h-[56px]" invalid={!!error} />
            </div>
            <div>
              <FieldLabel htmlFor="bulk-in">Check in (optional)</FieldLabel>
              <Input id="bulk-in" type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} />
            </div>
          </div>
          {error ? <p role="alert" className="text-xs font-semibold text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <LoadingButton type="button" variant="success" loading={bulk.isPending} onClick={submit}>
              Mark {selected.size} present
            </LoadingButton>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </HrPanel>
  );
}

function DayView({ date, setDate, canMark }: { date: string; setDate: (d: string) => void; canMark: boolean }) {
  const m = useMotionSafe();
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<DayStatus | 'ALL'>('ALL');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [bulk, setBulk] = React.useState(false);
  const q = useDayAttendance(date, {});
  const future = date > todayYmd();
  const items = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data?.items ?? []).filter((i) => (filter === 'ALL' || i.attendance.status === filter) && (!term || i.employee.name.toLowerCase().includes(term) || i.employee.employeeId.toLowerCase().includes(term)));
  }, [q.data, search, filter]);

  const s = q.data?.summary;
  const chips: { key: DayStatus | 'ALL'; label: string; n: number | undefined }[] = [
    { key: 'ALL', label: 'All', n: q.data?.items.length },
    { key: 'PRESENT', label: 'Present', n: s?.present },
    { key: 'LATE', label: 'Late', n: s?.late },
    { key: 'HALF_DAY', label: 'Half day', n: s?.halfDay },
    { key: 'ON_LEAVE', label: 'On leave', n: s?.onLeave },
    { key: 'ABSENT', label: 'Absent', n: s?.absent },
    { key: 'NOT_MARKED', label: 'Not marked', n: s?.notMarked },
  ];

  return (
    <div className="space-y-3.5">
      <HrPanel
        title="Daily roster"
        subtitle={formatDay(date, 'long')}
        icon={CalendarCheck}
        tone="var(--success)"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DateStepper date={date} onChange={(d) => { setDate(d); setOpenId(null); }} />
            {canMark && !future ? (
              <Button type="button" size="sm" onClick={() => setBulk((v) => !v)} aria-expanded={bulk}>
                <ListChecks className="size-4" /> Mark all present
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {chips.map((c) => (
            <Pill key={c.key} active={filter === c.key} color={c.key === 'ALL' ? undefined : TONES[DAY_STATUS_TONE[c.key as DayStatus]].color} onClick={() => setFilter(c.key)}>
              {c.label}
              {c.n !== undefined ? <span className="rounded-full bg-black/10 px-1.5 text-[11px] tabular-nums">{c.n}</span> : null}
            </Pill>
          ))}
          <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="h-9 pl-9" />
          </div>
        </div>

        {q.isPending ? (
          <RowsSkeleton rows={5} />
        ) : q.isError ? (
          <HrError message={q.error.message} onRetry={() => void q.refetch()} />
        ) : items.length === 0 ? (
          <HrEmpty icon={CalendarCheck} title="No employees match" description="Change the status filter or search." compact />
        ) : (
          <ul className="space-y-2">
            {items.map((it, i) => {
              const a = it.attendance;
              const tone = DAY_STATUS_TONE[a.status];
              const open = openId === it.employee.userId;
              return (
                <motion.li
                  key={it.employee.userId}
                  layout={!m.reduce}
                  initial={m.reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.03 }}
                  className="rounded-2xl border bg-card p-2.5 sm:p-3"
                  style={{ boxShadow: `inset 4px 0 0 ${TONES[tone].color}` }}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex min-w-[190px] flex-1 items-center gap-2.5">
                      <HrAvatar name={it.employee.name} size={38} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold">{it.employee.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {it.employee.employeeId} · {roleLabel(it.employee.role)}
                          {it.shift ? ` · ${it.shift.name}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="w-[118px]">
                      <ToneChip tone={tone} label={DAY_STATUS_LABEL[a.status]} />
                      {a.leaveType ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.leaveType.name}</p> : a.holidayName ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.holidayName}</p> : null}
                    </div>
                    <dl className="grid grid-cols-3 gap-3 text-center text-xs">
                      <div>
                        <dt className="text-muted-foreground">In</dt>
                        <dd className="font-extrabold tabular-nums">{formatTime(a.checkInAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Out</dt>
                        <dd className="font-extrabold tabular-nums">{formatTime(a.checkOutAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Worked</dt>
                        <dd className="font-extrabold tabular-nums">{a.workedMinutes != null ? formatMinutes(a.workedMinutes) : '--'}</dd>
                      </div>
                    </dl>
                    <div className="min-w-[90px]">
                      <SourceTag item={it} />
                    </div>
                    {canMark && !future ? (
                      <Button type="button" size="sm" variant={open ? 'default' : 'outline'} aria-expanded={open} onClick={() => setOpenId(open ? null : it.employee.userId)}>
                        {a.recorded ? 'Edit' : 'Mark'}
                      </Button>
                    ) : null}
                  </div>
                  {a.remark ? <p className="mt-1.5 text-xs text-muted-foreground">Remark: {a.remark}</p> : null}
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div initial={m.reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={m.reduce ? undefined : { opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="pt-2.5">
                          <MarkAttendanceForm userId={it.employee.userId} name={it.employee.name} date={date} existing={a} onDone={() => setOpenId(null)} onCancel={() => setOpenId(null)} />
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
        )}
      </HrPanel>
      {bulk && canMark && q.data ? <BulkPanel date={date} items={q.data.items} onClose={() => setBulk(false)} /> : null}
    </div>
  );
}

function MonthGrid({ month, setMonth, onPick }: { month: string; setMonth: (m: string) => void; onPick: (date: string) => void }) {
  const q = useMonthlyGrid(month);
  const today = todayYmd();
  return (
    <HrPanel title="Monthly grid" subtitle="Tap a cell to open that day" icon={Table2} tone="var(--chart-3)" action={<MonthStepper value={month} onChange={setMonth} />}>
      {q.isPending ? (
        <RowsSkeleton rows={4} />
      ) : q.isError ? (
        <HrError message={q.error.message} onRetry={() => void q.refetch()} />
      ) : q.data.employees.length === 0 ? (
        <HrEmpty icon={Table2} title="No employees" compact />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-max min-w-full border-collapse text-[11px]">
              <caption className="sr-only">Attendance grid for {formatMonth(month)}</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-[150px] border-b bg-card px-2 py-1.5 text-left text-xs font-bold">Employee</th>
                  {q.data.days.map((d) => (
                    <th key={d} scope="col" className={cn('border-b px-0.5 py-1.5 text-center font-bold tabular-nums', d === today && 'text-primary')}>
                      {Number(d.slice(8))}
                    </th>
                  ))}
                  <th scope="col" className="border-b px-2 py-1.5 text-center font-bold">P</th>
                  <th scope="col" className="border-b px-2 py-1.5 text-center font-bold">A</th>
                </tr>
              </thead>
              <tbody>
                {q.data.employees.map((e) => (
                  <tr key={e.employee.userId} className="hover:bg-accent/40">
                    <th scope="row" className="sticky left-0 z-10 border-b bg-card px-2 py-1 text-left">
                      <span className="flex items-center gap-1.5">
                        <HrAvatar name={e.employee.name} size={22} />
                        <span className="truncate text-xs font-bold">{e.employee.name}</span>
                      </span>
                    </th>
                    {e.cells.map((c, i) => {
                      const meta = TONES[DAY_STATUS_TONE[c]];
                      const Icon = meta.icon;
                      const date = q.data.days[i]!;
                      return (
                        <td key={date} className="border-b p-0.5 text-center">
                          <button
                            type="button"
                            onClick={() => onPick(date)}
                            aria-label={`${e.employee.name}, ${formatDay(date, 'weekday')}: ${DAY_STATUS_LABEL[c]}`}
                            title={`${formatDay(date, 'weekday')}: ${DAY_STATUS_LABEL[c]}`}
                            className="flex size-6 items-center justify-center rounded-md transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            style={{ backgroundColor: mix(meta.color, c === 'NOT_MARKED' || c === 'NOT_JOINED' ? 4 : 18), color: meta.color }}
                          >
                            <Icon className="size-3" aria-hidden strokeWidth={3} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b px-2 text-center font-extrabold tabular-nums">{e.stats.present + e.stats.late + e.stats.halfDay}</td>
                    <td className="border-b px-2 text-center font-extrabold tabular-nums text-destructive">{e.stats.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StatusLegend className="mt-3" />
        </>
      )}
    </HrPanel>
  );
}

export function AttendancePage() {
  const access = useHrAccess();
  const [view, setView] = React.useState<View>('day');
  const [date, setDate] = React.useState(todayYmd());
  const [month, setMonth] = React.useState(currentMonth());
  const summary = useDayAttendance(todayYmd(), {}, { enabled: access.view });
  const s = summary.data?.summary;

  return (
    <RequirePermission permission="hr:view">
      <div className="space-y-3.5">
        <HrHero
          eyebrow="Attendance"
          icon={CalendarRange}
          title="Team attendance"
          subtitle="See who is in, correct a punch, or mark a whole day. Every manual change keeps your remark and name."
          stats={s ? [{ label: 'Present today', value: <AnimatedNumber value={s.present + s.late + s.halfDay} /> }, { label: 'On leave', value: <AnimatedNumber value={s.onLeave} /> }, { label: 'Yet to check in', value: <AnimatedNumber value={s.notMarked} /> }] : undefined}
        />
        <SegmentedTabs
          ariaLabel="Attendance views"
          value={view}
          onChange={setView}
          accent="analytics"
          options={[
            { value: 'day', label: 'Day view', icon: CalendarCheck },
            { value: 'month', label: 'Month grid', icon: Table2 },
          ]}
        />
        {view === 'day' ? (
          <DayView date={date} setDate={(d) => { setDate(d); setMonth(monthOf(d)); }} canMark={access.attendanceManage} />
        ) : (
          <MonthGrid
            month={month}
            setMonth={setMonth}
            onPick={(d) => {
              setDate(d);
              setView('day');
            }}
          />
        )}
      </div>
    </RequirePermission>
  );
}
