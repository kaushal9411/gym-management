'use client';

import { motion } from 'framer-motion';
import { Award, CheckCircle2, Dumbbell, Users, XCircle, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, CountUp, IconChip, PanelCard, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { WorkoutLevel, WorkoutPlanListItem } from '../types';

const LEVEL_LABELS: Record<WorkoutLevel, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };

interface KpiTile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
  status?: 'true' | 'false' | '';
}

export function WorkoutPlansKpis({
  plans,
  loading,
  isActiveFilter,
  onStatus,
}: {
  plans: WorkoutPlanListItem[];
  loading: boolean;
  isActiveFilter: 'true' | 'false' | '';
  onStatus: (v: 'true' | 'false' | '') => void;
}) {
  const live = plans.filter((p) => !p.deletedAt);
  const active = live.filter((p) => p.isActive).length;
  const inactive = live.length - active;
  const totalMembers = plans.reduce((s, p) => s + p.activeMemberCount, 0);

  const tiles: KpiTile[] = [
    { key: 'total', label: 'Total plans', icon: Dumbbell, accent: 'primary', value: plans.length, status: '' },
    { key: 'active', label: 'Active', icon: CheckCircle2, accent: 'success', value: active, status: 'true' },
    { key: 'inactive', label: 'Inactive', icon: XCircle, accent: 'warning', value: inactive, status: 'false' },
    { key: 'members', label: 'Active members assigned', icon: Users, accent: 'violet', value: totalMembers },
  ];

  return (
    <section aria-label="Plan figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t, i) => {
        const clickable = t.status !== undefined;
        const isOn = clickable && isActiveFilter === t.status;
        const Tag = clickable ? 'button' : 'div';
        return (
          <motion.div key={t.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ duration: 0.45, delay: 0.04 * i }}>
            <Tag
              {...(clickable ? { type: 'button' as const, onClick: () => onStatus(t.status!), 'aria-pressed': isOn } : {})}
              className="block h-full w-full rounded-2xl border p-3.5 text-left shadow-xs transition-shadow hover:shadow-md"
              style={{
                backgroundImage: `linear-gradient(160deg, ${tint(t.accent, 13)}, transparent 72%)`,
                borderColor: isOn ? accentVar(t.accent) : tint(t.accent, 22),
                boxShadow: isOn ? `0 0 0 2px ${tint(t.accent, 35)}` : undefined,
              }}
            >
              <IconChip icon={t.icon} accent={t.accent} className="size-8" />
              <div className="mt-2.5 text-2xl font-extrabold leading-tight tabular-nums" style={{ color: accentVar(t.accent) }}>
                {loading ? <Skeleton className="h-7 w-10" /> : <CountUp value={t.value} />}
              </div>
              <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
            </Tag>
          </motion.div>
        );
      })}
    </section>
  );
}

function BarRows({ rows, accent }: { rows: Array<{ label: string; count: number }>; accent: Accent }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-[12.5px]">
            <b className="truncate pr-2 font-semibold">{r.label}</b>
            <span className="shrink-0 tabular-nums text-muted-foreground">{r.count}</span>
          </div>
          <ProgressBar percent={(r.count / max) * 100} accent={accent} />
        </div>
      ))}
    </div>
  );
}

export function WorkoutPlansInsights({ plans, loading }: { plans: WorkoutPlanListItem[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-60 w-full rounded-2xl" />)}
      </section>
    );
  }

  const live = plans.filter((p) => !p.deletedAt);
  const active = live.filter((p) => p.isActive).length;
  const inactive = live.length - active;
  const total = live.length;
  const activePct = total > 0 ? (active / total) * 100 : 0;

  const levelCounts = new Map<WorkoutLevel, number>();
  live.forEach((p) => levelCounts.set(p.level, (levelCounts.get(p.level) ?? 0) + 1));
  const levelRows = (['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as WorkoutLevel[])
    .map((level) => ({ label: LEVEL_LABELS[level], count: levelCounts.get(level) ?? 0 }))
    .filter((r) => r.count > 0);

  const trainerCounts = new Map<string, number>();
  live.forEach((p) => {
    const key = p.trainer?.name ?? 'Unassigned';
    trainerCounts.set(key, (trainerCounts.get(key) ?? 0) + 1);
  });
  const trainerRows = [...trainerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count }));

  return (
    <section aria-label="Plan reports" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <PanelCard icon={Dumbbell} accent="primary" title="Status mix" delay={0.2}>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="grid size-[112px] place-items-center rounded-full" style={{ backgroundImage: total > 0 ? `conic-gradient(var(--success) 0% ${activePct}%, var(--warning) ${activePct}% 100%)` : `conic-gradient(${tint('primary', 14)} 0 100%)` }} role="img" aria-label={`${active} active of ${total}`}>
            <div className="grid size-[78px] place-items-center rounded-full bg-card text-center leading-tight">
              <div>
                <b className="block text-[22px] font-extrabold tabular-nums">{total}</b>
                <span className="text-[10.5px] text-muted-foreground">plans</span>
              </div>
            </div>
          </div>
          <ul className="grid gap-1.5 text-[12.5px]">
            <li className="flex items-center gap-2"><i className="size-2.5 rounded-[3px]" style={{ background: 'var(--success)' }} />Active<b className="ml-auto pl-3 tabular-nums">{active}</b></li>
            <li className="flex items-center gap-2"><i className="size-2.5 rounded-[3px]" style={{ background: 'var(--warning)' }} />Inactive<b className="ml-auto pl-3 tabular-nums">{inactive}</b></li>
          </ul>
        </div>
      </PanelCard>

      <PanelCard icon={Award} accent="aqua" title="By level" delay={0.26}>
        <BarRows rows={levelRows} accent="aqua" />
      </PanelCard>

      <PanelCard icon={Users} accent="violet" title="By trainer" delay={0.32}>
        <BarRows rows={trainerRows} accent="violet" />
      </PanelCard>
    </section>
  );
}
