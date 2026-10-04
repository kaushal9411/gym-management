'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRightLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { ErrorNote, fmtDate, PagerBar, statusLabel, statusTone, TableScroll, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { toPlanError, usePlanSubscribers, usePlans } from '../hooks/use-plans';
import type { Plan } from '../types';
import { ChangePlanInline } from './change-plan-inline';

function renewsIn(end: string | null, status: string, now: number | null): string {
  if (!end || now === null) return '—';
  const days = Math.ceil((new Date(end).getTime() - now) / 86_400_000);
  const verb = status === 'TRIALING' ? 'Trial ends' : 'Renews';
  if (days < 0) return `${verb.split(' ')[0]} overdue ${-days}d`;
  return days === 0 ? `${verb} today` : `${verb} in ${days} day${days === 1 ? '' : 's'}`;
}

export function SubscribersTable({ plan, total }: { plan: Plan; total: number }) {
  const canChange = useHasPermission('payments:manage'); // same gate as the old page's "Change plan" button
  const [page, setPage] = React.useState(1);
  const q = usePlanSubscribers(plan.id, { page, limit: 10 });
  const allPlans = usePlans();
  const now = useNow(60_000);
  const [changing, setChanging] = React.useState<string | null>(null);
  const rows = q.data?.items ?? [];
  return (
    <Panel title="Subscribers" hint={`${q.data?.total ?? total} tenant${(q.data?.total ?? total) === 1 ? '' : 's'}`} index={8}>
      {q.isError ? <ErrorNote what="subscribers" message={toPlanError(q.error).message} onRetry={() => void q.refetch()} />
        : q.isPending ? <Skeleton className="h-40 rounded-lg" />
        : rows.length === 0 ? <EmptyNote>No tenants on this plan yet.</EmptyNote> : (
          <>
            <TableScroll label="Plan subscribers">
              <table className="w-full min-w-[720px] border-collapse">
                <thead><tr>
                  <th scope="col" className={thClass}>Tenant</th><th scope="col" className={thClass}>Status</th><th scope="col" className={thClass}>Billing cycle</th>
                  <th scope="col" className={thClass}>Period end</th><th scope="col" className={thClass}>Renewal</th><th scope="col" className={`${thClass} relative`}><span className="sr-only">Actions</span></th>
                </tr></thead>
                <tbody>
                  {rows.map((s) => (
                    <React.Fragment key={s.id}>
                      <tr>
                        <td className={tdClass}><Link href={`/tenants/${s.tenant.id}`} className="font-semibold hover:underline">{s.tenant.name}</Link><span className="block font-mono text-[11px] text-muted-foreground">{s.tenant.slug}</span></td>
                        <td className={tdClass}><Chip tone={statusTone(s.status)}>{statusLabel(s.status)}</Chip></td>
                        <td className={tdClass}>{statusLabel(s.billingCycle)}</td>
                        <td className={tdClass}>{fmtDate(s.currentPeriodEnd)}</td>
                        <td className={`${tdClass} text-muted-foreground`}>{renewsIn(s.currentPeriodEnd, s.status, now)}</td>
                        <td className={tdClass}>
                          <div className="flex justify-end gap-1.5">
                            <Button asChild size="sm" variant="outline"><Link href={`/tenants/${s.tenant.id}`}>View tenant</Link></Button>
                            {canChange ? <Button size="sm" variant="outline" aria-expanded={changing === s.id} onClick={() => setChanging((c) => (c === s.id ? null : s.id))}><ArrowRightLeft className="size-3.5" aria-hidden />Change plan</Button> : null}
                          </div>
                        </td>
                      </tr>
                      {changing === s.id ? (
                        <tr><td colSpan={6} className="border-b p-3"><ChangePlanInline key={s.id} tenant={s.tenant} cycle={s.billingCycle} currentPlan={plan} plans={allPlans.data ?? []} onClose={() => setChanging(null)} /></td></tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <PagerBar page={q.data?.page ?? 1} totalPages={q.data?.totalPages ?? 1} total={q.data?.total ?? 0} onPage={(p) => { setChanging(null); setPage(p); }} />
          </>
        )}
    </Panel>
  );
}
