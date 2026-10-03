'use client';

import { motion } from 'framer-motion';
import { BadgeCheck, Building2, ShieldCheck, Star } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { type Accent, PanelCard, ProgressBar, accentVar, formatMoney, tint } from '@/features/members/components/detail/detail-ui';
import { isPaginated, useBranchComparison, useKpis, usePaymentCollection, useReportData } from '@/features/reports/hooks/use-reports';
import { useTenant } from '@/features/tenant/tenant-provider';
import { useCurrencySymbol } from '@/lib/currency';
import { useDashboardRange } from '../hooks/use-dashboard-range';

const BRANCH_TONES: Accent[] = ['primary', 'violet', 'aqua', 'warning', 'success'];

export function BranchPanel() {
  const symbol = useCurrencySymbol();
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const comparison = useBranchComparison(currentBranchId ?? undefined);
  if (!hasPermission('analytics:view')) return null;

  const rows = comparison.data ?? [];
  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <PanelCard icon={Building2} accent="primary" title="Branch comparison" delay={0.68} right={<span className="text-xs text-muted-foreground">This month</span>}>
      {comparison.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No branch data yet.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.branchId} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <b className="font-semibold">{r.branch}</b>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {r.members} members · {r.attendance} visits
                </span>
              </div>
              <ProgressBar percent={(r.revenue / maxRevenue) * 100} accent={BRANCH_TONES[i % BRANCH_TONES.length]!} />
              <p className="text-right text-xs tabular-nums text-muted-foreground">Revenue {formatMoney(symbol, r.revenue)}</p>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

interface TrainerRow {
  trainerId: string;
  name: string;
  assignedMembers: number;
}

export function StaffPanel() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const kpis = useKpis(currentBranchId ?? undefined).data;
  const trainers = useReportData<TrainerRow>('trainer-performance', { limit: 4, branchId: currentBranchId ?? undefined });
  if (!hasPermission('reports:view')) return null;

  const rows = isPaginated(trainers.data) ? trainers.data.items : ((trainers.data as TrainerRow[] | undefined) ?? []);

  return (
    <PanelCard icon={BadgeCheck} accent="violet" title="Staff" delay={0.74}>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { v: kpis?.totalStaff ?? 0, l: 'Total staff', c: 'violet' as const },
          { v: kpis?.activeTrainers ?? 0, l: 'Active trainers', c: 'aqua' as const },
        ].map((t) => (
          <div key={t.l} className="rounded-xl border p-3" style={{ backgroundColor: tint(t.c, 9), borderColor: tint(t.c, 20) }}>
            <b className="block text-2xl font-extrabold tabular-nums">{t.v}</b>
            <span className="text-xs text-muted-foreground">{t.l}</span>
          </div>
        ))}
      </div>
      {rows.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trainer load</p>
          <ul className="space-y-1">
            {rows.map((t, i) => (
              <motion.li key={t.trainerId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm">
                <span className="flex size-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ backgroundImage: 'linear-gradient(135deg, var(--chart-7), var(--primary))' }}>
                  {t.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{t.assignedMembers} clients</span>
              </motion.li>
            ))}
          </ul>
        </div>
      ) : null}
    </PanelCard>
  );
}

function Ring({ percent, label, accent }: { percent: number; label: string; accent: Accent }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        className="mx-auto grid size-24 place-items-center rounded-full"
        style={{ backgroundImage: `conic-gradient(${accentVar(accent)} ${p}%, ${tint(accent, 16)} 0)` }}
      >
        <div className="grid size-[68px] place-items-center rounded-full bg-card">
          <b className="text-xl font-extrabold tabular-nums">{Math.round(p)}%</b>
        </div>
      </motion.div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function HealthPanel() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const { dateFrom, dateTo } = useDashboardRange();
  const kpis = useKpis(currentBranchId ?? undefined).data;
  const collection = usePaymentCollection(dateFrom, dateTo, currentBranchId ?? undefined);
  if (!hasPermission('reports:view')) return null;

  // `usePaymentCollection` reuses the revenue shape: `income` = collected, `expenses` = invoiced.
  const collected = (collection.data ?? []).reduce((s, p) => s + p.income, 0);
  const invoiced = (collection.data ?? []).reduce((s, p) => s + p.expenses, 0);
  const rate = invoiced > 0 ? Math.min((collected / invoiced) * 100, 100) : collected > 0 ? 100 : 0;
  const activeShare = kpis && kpis.totalMembers > 0 ? (kpis.activeMembers / kpis.totalMembers) * 100 : 0;

  return (
    <PanelCard icon={Star} accent="success" title="Collection & membership health" delay={0.8}>
      <div className="grid grid-cols-2 gap-3">
        <Ring percent={rate} label="Invoiced amount collected" accent="success" />
        <Ring percent={activeShare} label="Members active" accent="primary" />
      </div>
    </PanelCard>
  );
}

export function PlanPanel() {
  const tenant = useTenant();
  const { currentBranchId } = useCurrentBranch();
  const kpis = useKpis(currentBranchId ?? undefined).data;
  const sub = tenant.subscription;
  const trialEnds = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <PanelCard icon={ShieldCheck} accent="aqua" title="Your plan" delay={0.86}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Plan</dt>
        <dd className="text-right font-semibold">{sub?.planName ?? '—'}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="text-right font-semibold">{sub?.status ?? '—'}</dd>
        {trialEnds ? (
          <>
            <dt className="text-muted-foreground">Trial ends</dt>
            <dd className="text-right font-semibold tabular-nums">{trialEnds.toLocaleDateString()}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Active branches</dt>
        <dd className="text-right font-semibold tabular-nums">{kpis?.activeBranches ?? '—'}</dd>
        <dt className="text-muted-foreground">Currency</dt>
        <dd className="text-right font-semibold">{tenant.currency}</dd>
      </dl>
      {daysLeft !== null ? (
        <div>
          <ProgressBar percent={Math.max(0, 100 - (daysLeft / 14) * 100)} accent="aqua" />
          <p className="mt-1 text-xs text-muted-foreground">{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left in your trial</p>
        </div>
      ) : null}
    </PanelCard>
  );
}
