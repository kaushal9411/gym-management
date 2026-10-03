'use client';

import { Users } from 'lucide-react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { PanelCard, ProgressBar, tint } from '@/features/members/components/detail/detail-ui';
import { useKpis } from '@/features/reports/hooks/use-reports';

export function MembersPanel() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const d = useKpis(currentBranchId ?? undefined).data;
  if (!hasPermission('reports:view')) return null;

  const total = d?.totalMembers ?? 0;
  const expiring = Math.min(d?.expiringMemberships ?? 0, d?.activeMembers ?? 0);
  const activeOnly = Math.max((d?.activeMembers ?? 0) - expiring, 0);
  const inactive = d?.inactiveMembers ?? 0;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const a = pct(activeOnly);
  const b = a + pct(expiring);

  const keys = [
    { label: 'Active', value: activeOnly, color: 'var(--primary)' },
    { label: 'Expiring in 30 days', value: expiring, color: 'var(--warning)' },
    { label: 'Inactive', value: inactive, color: 'var(--destructive)' },
  ];

  return (
    <PanelCard icon={Users} accent="primary" title="Members" delay={0.34} right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: tint('primary', 14), color: 'var(--primary)' }}>{total} total</span>}>
      <div className="flex flex-wrap items-center justify-center gap-5">
        <div
          className="grid size-[150px] place-items-center rounded-full"
          style={{ backgroundImage: total > 0 ? `conic-gradient(var(--primary) 0 ${a}%, var(--warning) 0 ${b}%, var(--destructive) 0 100%)` : `conic-gradient(${tint('primary', 14)} 0 100%)` }}
          role="img"
          aria-label={`${d?.activeMembers ?? 0} active of ${total} members`}
        >
          <div className="grid size-[106px] place-items-center rounded-full bg-card text-center leading-tight">
            <div>
              <b className="block text-3xl font-extrabold tabular-nums">{d?.activeMembers ?? 0}</b>
              <span className="text-[11px] text-muted-foreground">active</span>
            </div>
          </div>
        </div>
        <ul className="grid gap-2 text-sm">
          {keys.map((k) => (
            <li key={k.label} className="flex items-center gap-2">
              <i className="size-2.5 rounded-[3px]" style={{ background: k.color }} />
              {k.label}
              <b className="ml-auto pl-4 tabular-nums">{k.value}</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm"><b>New this month</b><span className="tabular-nums text-muted-foreground">+{d?.newMembersThisMonth ?? 0}</span></div>
          <ProgressBar className="mt-1.5" percent={total > 0 ? ((d?.newMembersThisMonth ?? 0) / total) * 100 : 0} accent="violet" />
        </div>
        <div>
          <div className="flex justify-between text-sm"><b>Active share</b><span className="tabular-nums text-muted-foreground">{Math.round(pct(d?.activeMembers ?? 0))}%</span></div>
          <ProgressBar className="mt-1.5" percent={pct(d?.activeMembers ?? 0)} accent="success" />
        </div>
      </div>
    </PanelCard>
  );
}
