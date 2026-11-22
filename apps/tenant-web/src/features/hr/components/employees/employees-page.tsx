'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock3, Contact, Hourglass, Search, Users } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { RequirePermission } from '@/features/auth/guards/require-permission';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { mix } from '../../lib/hr-palette';
import { DAY_STATUS_LABEL, DAY_STATUS_TONE, roleLabel, weekdayShort } from '../../lib/status';
import { useEmployees } from '../../hooks/use-hr';
import { AnimatedNumber, HrAvatar, HrEmpty, HrError, HrHero, RowsSkeleton, ToneChip } from '../ui/hr-ui';

export function EmployeesPage() {
  const m = useMotionSafe();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebouncedValue(search, 300);
  const q = useEmployees({ search: debounced || undefined, page, limit: 12 });

  return (
    <RequirePermission permission="hr:view">
      <div className="space-y-3.5">
        <HrHero
          eyebrow="Directory"
          icon={Contact}
          title="Employees"
          subtitle="Today's status, shifts and leave balances for everyone on the team."
          stats={q.data ? [{ label: 'Employees', value: <AnimatedNumber value={q.data.total} /> }] : undefined}
        />
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search employees"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email or employee ID"
            className="h-11 rounded-xl pl-10"
          />
        </div>

        {q.isPending ? (
          <RowsSkeleton rows={4} height={150} />
        ) : q.isError ? (
          <HrError message={q.error.message} onRetry={() => void q.refetch()} />
        ) : q.data.items.length === 0 ? (
          <HrEmpty icon={Users} title="No employees found" description={debounced ? 'Try a different search.' : 'Employees come from Staff - add a staff member to see them here.'} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {q.data.items.map((e, i) => {
                const tone = DAY_STATUS_TONE[e.today.status];
                return (
                  <motion.div key={e.userId} initial={m.reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04 }} whileHover={m.reduce ? undefined : { y: -3 }}>
                    <Link href={`/hr/employees/${e.userId}`} className="block h-full rounded-[20px] border bg-card p-4 shadow-xs transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex items-start gap-3">
                        <HrAvatar name={e.name} size={46} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-extrabold">{e.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {e.employeeId} · {roleLabel(e.role)}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="size-3" aria-hidden /> {e.shift ? `${e.shift.name} ${e.shift.startTime}-${e.shift.endTime}` : 'No shift'}
                            {e.weeklyOff.length ? ` · off ${e.weeklyOff.map(weekdayShort).join(', ')}` : ''}
                          </p>
                        </div>
                        <ToneChip tone={tone} label={DAY_STATUS_LABEL[e.today.status]} small />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {e.today.checkInTime ? (
                          <>
                            In <b className="text-foreground">{e.today.checkInTime}</b>
                            {e.today.checkOutTime ? <> · Out <b className="text-foreground">{e.today.checkOutTime}</b></> : ' · still working'}
                          </>
                        ) : (
                          'No punch yet today'
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {e.leaveBalances.map((b) => (
                          <span key={b.leaveTypeId} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-bold" title={`${b.name}: ${b.available ?? 'unlimited'} available`}>
                            {b.code} <span className="tabular-nums">{b.available ?? '∞'}</span>
                          </span>
                        ))}
                        {e.pendingLeaves > 0 ? (
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: mix('var(--warning)', 20) }}>
                            <Hourglass className="size-3" aria-hidden /> {e.pendingLeaves} pending
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            {q.data.totalPages > 1 ? <Pagination page={page} totalPages={q.data.totalPages} onPageChange={setPage} totalItems={q.data.total} pageSize={12} /> : null}
          </>
        )}
      </div>
    </RequirePermission>
  );
}
