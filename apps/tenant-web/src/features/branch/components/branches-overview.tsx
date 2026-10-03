'use client';

import { motion } from 'framer-motion';
import { Building2, CheckCircle2, Contact, Users, XCircle, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, CountUp, IconChip, PanelCard, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { BranchDetail } from '../types';

interface KpiTile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
  status?: 'true' | 'false' | '';
}

export function BranchesKpis({
  branches,
  loading,
  isActiveFilter,
  onStatus,
}: {
  branches: BranchDetail[];
  loading: boolean;
  isActiveFilter: 'true' | 'false' | '';
  onStatus: (v: 'true' | 'false' | '') => void;
}) {
  const active = branches.filter((b) => b.isActive && !b.deletedAt).length;
  const inactive = branches.filter((b) => !b.isActive && !b.deletedAt).length;
  const totalMembers = branches.reduce((s, b) => s + b.memberCount, 0);
  const totalStaff = branches.reduce((s, b) => s + b.staffCount, 0);

  const tiles: KpiTile[] = [
    { key: 'total', label: 'Total branches', icon: Building2, accent: 'primary', value: branches.length, status: '' },
    { key: 'active', label: 'Active', icon: CheckCircle2, accent: 'success', value: active, status: 'true' },
    { key: 'inactive', label: 'Inactive', icon: XCircle, accent: 'warning', value: inactive, status: 'false' },
    { key: 'members', label: 'Members across branches', icon: Users, accent: 'violet', value: totalMembers },
    { key: 'staff', label: 'Staff across branches', icon: Contact, accent: 'aqua', value: totalStaff },
  ];

  return (
    <section aria-label="Branch figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
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

export function BranchesInsights({ branches, loading }: { branches: BranchDetail[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-60 w-full rounded-2xl" />)}
      </section>
    );
  }

  const live = branches.filter((b) => !b.deletedAt);
  const active = live.filter((b) => b.isActive).length;
  const inactive = live.length - active;
  const total = live.length;
  const activePct = total > 0 ? (active / total) * 100 : 0;

  const topByMembers = [...live].sort((a, b) => b.memberCount - a.memberCount).slice(0, 6).map((b) => ({ label: b.name, count: b.memberCount }));
  const topByStaff = [...live].sort((a, b) => b.staffCount - a.staffCount).slice(0, 6).map((b) => ({ label: b.name, count: b.staffCount }));

  return (
    <section aria-label="Branch reports" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <PanelCard icon={Building2} accent="primary" title="Status mix" delay={0.2}>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="grid size-[112px] place-items-center rounded-full" style={{ backgroundImage: total > 0 ? `conic-gradient(var(--success) 0% ${activePct}%, var(--warning) ${activePct}% 100%)` : `conic-gradient(${tint('primary', 14)} 0 100%)` }} role="img" aria-label={`${active} active of ${total}`}>
            <div className="grid size-[78px] place-items-center rounded-full bg-card text-center leading-tight">
              <div>
                <b className="block text-[22px] font-extrabold tabular-nums">{total}</b>
                <span className="text-[10.5px] text-muted-foreground">branches</span>
              </div>
            </div>
          </div>
          <ul className="grid gap-1.5 text-[12.5px]">
            <li className="flex items-center gap-2"><i className="size-2.5 rounded-[3px]" style={{ background: 'var(--success)' }} />Active<b className="ml-auto pl-3 tabular-nums">{active}</b></li>
            <li className="flex items-center gap-2"><i className="size-2.5 rounded-[3px]" style={{ background: 'var(--warning)' }} />Inactive<b className="ml-auto pl-3 tabular-nums">{inactive}</b></li>
          </ul>
        </div>
      </PanelCard>

      <PanelCard icon={Users} accent="violet" title="Members per branch" delay={0.26}>
        <BarRows rows={topByMembers} accent="violet" />
      </PanelCard>

      <PanelCard icon={Contact} accent="aqua" title="Staff per branch" delay={0.32}>
        <BarRows rows={topByStaff} accent="aqua" />
      </PanelCard>
    </section>
  );
}
