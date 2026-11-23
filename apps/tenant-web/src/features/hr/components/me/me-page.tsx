'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarCheck, Plane, ReceiptIndianRupee, UserRound, Wallet } from 'lucide-react';

import { SegmentedTabs } from '@/features/reports/components/ui';
import { formatDay } from '../../lib/dates';
import { inr } from '../../lib/money';
import { hrErrorCode, useMeBalances, useMeSummary } from '../../hooks/use-hr';
import { shouldShowEnrollCard } from '../../lib/enroll';
import { roleLabel, useHrAccess } from '../../lib/status';
import { HrEmpty, HrHero } from '../ui/hr-ui';
import { EnrollCard } from './enroll-card';
import { MyLeavesTab } from './my-leaves-tab';
import { MyPayslipsTab } from './my-payslips-tab';
import { MyTodayTab } from './my-today-tab';

type TabKey = 'today' | 'leaves' | 'payslips';

export function MePage() {
  const access = useHrAccess();
  const router = useRouter();
  const params = useSearchParams();
  const summary = useMeSummary({ enabled: access.selfAttendance });
  // Leave-only users cannot read the summary, so their balances call is the probe for "not on the roster".
  const probe = useMeBalances({ enabled: !access.selfAttendance && access.selfLeave });

  const tabs = [
    access.selfAttendance ? { value: 'today' as const, label: 'Today', icon: CalendarCheck } : null,
    access.selfLeave ? { value: 'leaves' as const, label: 'My leaves', icon: Plane } : null,
    access.selfPayslip ? { value: 'payslips' as const, label: 'Payslips', icon: ReceiptIndianRupee } : null,
  ].filter((t): t is { value: TabKey; label: string; icon: typeof Wallet } => t !== null);

  const requested = params.get('tab') as TabKey | null;
  const active: TabKey | undefined = tabs.find((t) => t.value === requested)?.value ?? tabs[0]?.value;

  const setTab = (t: TabKey) => router.replace(t === tabs[0]?.value ? '/hr/me' : `/hr/me?tab=${t}`, { scroll: false });

  const notEmployee = (summary.isError && hrErrorCode(summary.error) === 'NOT_AN_EMPLOYEE') || (probe.isError && hrErrorCode(probe.error) === 'NOT_AN_EMPLOYEE');
  const offerEnroll = shouldShowEnrollCard(access.selfAttendance || access.selfLeave, notEmployee ? 'NOT_AN_EMPLOYEE' : undefined);
  const emp = summary.data?.employee;
  const stats = summary.data?.month.stats;
  const totalAvail = summary.data?.leaveBalances.reduce((s, b) => s + (b.available ?? 0), 0) ?? 0;

  return (
    <div className="space-y-3.5">
      <HrHero
        eyebrow="My HR"
        icon={UserRound}
        title={emp ? emp.name : 'My HR'}
        subtitle={emp ? `${emp.employeeId} · ${roleLabel(emp.role)} · joined ${formatDay(emp.joiningDate)} ${emp.joiningDate.slice(0, 4)}` : 'Check in, track your attendance, apply for leave and see your payslips.'}
        stats={
          summary.data && stats
            ? [
                { label: 'Days present this month', value: stats.present + stats.late },
                { label: 'Leave days available', value: totalAvail },
                ...(summary.data.latestPayslip ? [{ label: 'Latest net pay', value: inr(summary.data.latestPayslip.netPay) }] : []),
              ]
            : undefined
        }
      />

      {notEmployee ? (
        offerEnroll ? (
          <EnrollCard />
        ) : (
          <HrEmpty icon={UserRound} title="My HR is not available" description="Your account is not on the employee roster, so self-service HR is not available." />
        )
      ) : tabs.length === 0 ? (
        <HrEmpty icon={UserRound} title="Nothing here yet" description="Your role has no self-service HR access." />
      ) : (
        <>
          {tabs.length > 1 ? <SegmentedTabs ariaLabel="My HR sections" value={active!} onChange={setTab} options={tabs} accent="analytics" /> : null}
          {active === 'today' ? <MyTodayTab canAttend={access.selfAttendance} canLeave={access.selfLeave} /> : null}
          {active === 'leaves' ? <MyLeavesTab canApply={access.selfLeave} /> : null}
          {active === 'payslips' ? <MyPayslipsTab /> : null}
        </>
      )}
    </div>
  );
}
