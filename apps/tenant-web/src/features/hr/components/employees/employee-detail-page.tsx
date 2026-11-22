'use client';

import * as React from 'react';
import { CalendarCheck, Mail, MapPin, PenLine, Phone, Plane, ReceiptIndianRupee, ShieldCheck, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RequirePermission } from '@/features/auth/guards/require-permission';
import { SegmentedTabs } from '@/features/reports/components/ui';
import { currentMonth, formatDay, formatMonth, todayYmd } from '../../lib/dates';
import { leaveTypeColor } from '../../lib/hr-palette';
import { inr } from '../../lib/money';
import { DAY_STATUS_LABEL, DAY_STATUS_TONE, PAYSLIP_STATUS_TONE, roleLabel, useHrAccess } from '../../lib/status';
import { hrService } from '../../services/hr.service';
import { useEmployee } from '../../hooks/use-hr';
import { useQuery } from '@tanstack/react-query';
import type { EmployeeDetail } from '../../types';
import { LeaveRequestCard } from '../leave/leave-cards';
import { LeaveApplyForm } from '../leave/leave-apply-form';
import { MarkAttendanceForm } from '../attendance/mark-attendance-form';
import { PayslipView } from '../payroll/payslip-view';
import { AttendanceCalendar, DayDetail, StatsStrip, StatusLegend } from '../ui/attendance-calendar';
import { BalanceRing, HeroButton, HrAvatar, HrEmpty, HrError, HrHero, HrPanel, MonthStepper, RowsSkeleton, StaggerGroup, StaggerItem, ToneChip } from '../ui/hr-ui';
import { BalanceAdjustForm, PayStructureEditor, WorkSetupForm } from './employee-forms';

type Tab = 'profile' | 'attendance' | 'leave' | 'payslips';

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border bg-muted/20 px-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-[13.5px] font-semibold">{value}</p>
      </div>
    </div>
  );
}

function AttendanceTab({ data, month, setMonth, userId, canMark }: { data: EmployeeDetail; month: string; setMonth: (m: string) => void; userId: string; canMark: boolean }) {
  const [picked, setPicked] = React.useState<string>(todayYmd());
  const [marking, setMarking] = React.useState(false);
  const day = data.attendance.days.find((d) => d.date === picked);
  return (
    <HrPanel title="Attendance" subtitle="Tap a day to see the punches, source and remarks" icon={CalendarCheck} tone="var(--success)" action={<MonthStepper value={month} onChange={(m) => { setMonth(m); setPicked(`${m}-01`); setMarking(false); }} max={currentMonth()} />}>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <StatsStrip stats={data.attendance.stats} />
          <AttendanceCalendar month={month} days={data.attendance.days} selected={picked} onSelect={(d) => { setPicked(d.date); setMarking(false); }} />
          <StatusLegend />
        </div>
        <div className="space-y-3">
          {day ? (
            <DayDetail
              day={day}
              actions={
                canMark && day.date <= todayYmd() && !marking ? (
                  <Button type="button" size="sm" onClick={() => setMarking(true)}>
                    <PenLine className="size-3.5" /> {day.recorded ? 'Edit this day' : 'Mark this day'}
                  </Button>
                ) : null
              }
            />
          ) : (
            <HrEmpty icon={CalendarCheck} title="Pick a day" compact />
          )}
          {marking && day ? <MarkAttendanceForm userId={userId} name={data.employee.name} date={day.date} existing={day} onDone={() => setMarking(false)} onCancel={() => setMarking(false)} /> : null}
        </div>
      </div>
    </HrPanel>
  );
}

function LeaveTab({ data, userId, canManage }: { data: EmployeeDetail; userId: string; canManage: boolean }) {
  const [adjusting, setAdjusting] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  return (
    <div className="space-y-3.5">
      <HrPanel
        title="Leave balances"
        subtitle={data.balances[0] ? `Leave year ${data.balances[0].leaveYearLabel}` : undefined}
        icon={Plane}
        tone="var(--chart-7)"
        action={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setAdjusting((v) => !v)} aria-expanded={adjusting}>
                Adjust balance
              </Button>
              <Button type="button" size="sm" onClick={() => setApplying((v) => !v)} aria-expanded={applying}>
                Apply leave
              </Button>
            </div>
          ) : null
        }
      >
        {data.balances.length === 0 ? (
          <HrEmpty icon={Plane} title="No leave types" compact />
        ) : (
          <StaggerGroup className="flex flex-wrap gap-x-6 gap-y-4">
            {data.balances.map((b, i) => (
              <StaggerItem key={b.leaveType.id}>
                <div className="text-center">
                  <BalanceRing
 unlimited={b.entitled == null}
 remaining={b.available ?? b.used} total={b.entitled ?? Math.max(b.used + b.pending, 1)} color={leaveTypeColor(b.leaveType.color, i)} label={b.leaveType.name} />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {b.available == null ? 'Unlimited' : `${b.used} used`}
                    {b.pending ? ` · ${b.pending} pending` : ''}
                    {b.adjustment ? ` · adj ${b.adjustment > 0 ? '+' : ''}${b.adjustment}` : ''}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
        {adjusting && canManage ? (
          <div className="mt-4">
            <BalanceAdjustForm userId={userId} balances={data.balances} onClose={() => setAdjusting(false)} />
          </div>
        ) : null}
      </HrPanel>
      {applying && canManage ? <LeaveApplyForm mode="manager" defaultUserId={userId} onClose={() => setApplying(false)} /> : null}
      <HrPanel title="Leave history" subtitle="Latest 50 requests" icon={CalendarCheck} tone="var(--primary)">
        {!canManage ? (
          <HrEmpty icon={ShieldCheck} title="Leave details are restricted" description="You need leave management access to see leave requests." compact />
        ) : data.leaves.length === 0 ? (
          <HrEmpty icon={Plane} title="No leave requests yet" compact />
        ) : (
          <div className="space-y-2.5">
            {data.leaves.map((l, i) => (
              <LeaveRequestCard key={l.id} req={l} index={i} />
            ))}
          </div>
        )}
      </HrPanel>
    </div>
  );
}

function PayslipsTab({ data }: { data: EmployeeDetail }) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const detail = useQuery({ queryKey: ['hr', 'payroll', 'payslip', selected], queryFn: () => hrService.payslip(selected!), enabled: !!selected });
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <HrPanel title="Payslips" subtitle="Newest 12" icon={ReceiptIndianRupee} tone="var(--success)">
        {data.payslips.length === 0 ? (
          <HrEmpty icon={ReceiptIndianRupee} title="No payslips yet" description="Generate a payroll run to create one." compact />
        ) : (
          <ul className="space-y-2">
            {data.payslips.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setSelected(p.id)} aria-pressed={selected === p.id} className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{formatMonth(p.month)}</span>
                    <span className="block text-xs text-muted-foreground">Gross {inr(p.grossEarnings)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-extrabold tabular-nums">{inr(p.netPay)}</span>
                    <ToneChip tone={PAYSLIP_STATUS_TONE[p.status]} label={p.status === 'PAID' ? 'Paid' : 'Draft'} small />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </HrPanel>
      {selected ? detail.isPending ? <RowsSkeleton rows={1} height={420} /> : detail.isError ? <HrError onRetry={() => void detail.refetch()} /> : <PayslipView slip={detail.data} onPdf={() => hrService.payslipPdf(selected)} expenseLink /> : null}
    </div>
  );
}

export function EmployeeDetailPage({ userId }: { userId: string }) {
  const access = useHrAccess();
  const [tab, setTab] = React.useState<Tab>('profile');
  const [month, setMonth] = React.useState(currentMonth());
  const q = useEmployee(userId, month);

  const tabs = [
    { value: 'profile' as const, label: 'Profile & pay', icon: UserRound },
    { value: 'attendance' as const, label: 'Attendance', icon: CalendarCheck },
    { value: 'leave' as const, label: 'Leave', icon: Plane },
    ...(access.payrollManage ? [{ value: 'payslips' as const, label: 'Payslips', icon: ReceiptIndianRupee }] : []),
  ];

  return (
    <RequirePermission permission="hr:view">
      <div className="space-y-3.5">
        {q.isPending ? (
          <RowsSkeleton rows={2} height={140} />
        ) : q.isError ? (
          <HrError message={q.error.message} onRetry={() => void q.refetch()} />
        ) : (
          <>
            <HrHero
              eyebrow={`${q.data.employee.employeeId} · ${roleLabel(q.data.employee.role)}`}
              backHref="/hr/employees"
              backLabel="All employees"
              title={
                <span className="flex items-center gap-3">
                  <HrAvatar name={q.data.employee.name} size={52} className="ring-2 ring-white/60" />
                  {q.data.employee.name}
                </span>
              }
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  Today:
                  <span className="inline-flex rounded-full bg-white px-1 py-0.5">
                    <ToneChip tone={DAY_STATUS_TONE[q.data.employee.today.status]} label={DAY_STATUS_LABEL[q.data.employee.today.status]} />
                  </span>
                  <span>· joined {formatDay(q.data.employee.joiningDate)} {q.data.employee.joiningDate.slice(0, 4)}</span>
                </span>
              }
              actions={
                access.leaveManage ? (
                  <HeroButton solid onClick={() => setTab('leave')}>
                    <Plane className="size-4" aria-hidden /> Leave & balances
                  </HeroButton>
                ) : null
              }
            />
            <SegmentedTabs ariaLabel="Employee sections" value={tab} onChange={setTab} options={tabs} accent="analytics" />

            {tab === 'profile' ? (
              <div className="grid items-start gap-3.5 xl:grid-cols-2">
                <HrPanel title="Profile" icon={UserRound} tone="var(--primary)">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Info icon={Mail} label="Email" value={q.data.employee.email} />
                    <Info icon={Phone} label="Phone" value={q.data.employee.phone ?? '--'} />
                    <Info icon={MapPin} label="Branches" value={q.data.employee.branches.map((b) => b.name).join(', ') || '--'} />
                    <Info icon={ShieldCheck} label="Employment" value={`${q.data.employee.employmentType.replace(/_/g, ' ').toLowerCase()} · ${q.data.employee.workStatus.toLowerCase().replace(/_/g, ' ')}`} />
                  </div>
                </HrPanel>
                <WorkSetupForm key={`${q.data.employee.shift?.id ?? 'none'}-${q.data.employee.weeklyOff.join()}`} employee={q.data.employee} canEdit={access.settingsManage} />
                {access.payrollManage ? (
                  <div className="xl:col-span-2">
                    <PayStructureEditor userId={userId} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {tab === 'attendance' ? <AttendanceTab data={q.data} month={month} setMonth={setMonth} userId={userId} canMark={access.attendanceManage} /> : null}
            {tab === 'leave' ? <LeaveTab data={q.data} userId={userId} canManage={access.leaveManage} /> : null}
            {tab === 'payslips' && access.payrollManage ? <PayslipsTab data={q.data} /> : null}
          </>
        )}
      </div>
    </RequirePermission>
  );
}
