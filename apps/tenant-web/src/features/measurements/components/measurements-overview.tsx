'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, CalendarClock, ListChecks, Ruler, Users, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, CountUp, IconChip, PanelCard, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { MeasuredMember } from '../types';

const STALE_DAYS = 30;

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

interface KpiTile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
}

export function MeasurementsKpis({ members, loading }: { members: MeasuredMember[]; loading: boolean }) {
  const totalEntries = members.reduce((s, m) => s + m.count, 0);
  const avgEntries = members.length > 0 ? Math.round((totalEntries / members.length) * 10) / 10 : 0;
  const measuredThisWeek = members.filter((m) => daysSince(m.latest.recordedAt) <= 7).length;

  const tiles: KpiTile[] = [
    { key: 'members', label: 'Members tracked', icon: Users, accent: 'primary', value: members.length },
    { key: 'entries', label: 'Total entries logged', icon: ListChecks, accent: 'violet', value: totalEntries },
    { key: 'week', label: 'Measured this week', icon: CalendarClock, accent: 'success', value: measuredThisWeek },
    { key: 'avg', label: 'Avg entries / member', icon: Ruler, accent: 'aqua', value: avgEntries },
  ];

  return (
    <section aria-label="Measurement figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t, i) => (
        <motion.div key={t.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ duration: 0.45, delay: 0.04 * i }}>
          <div
            className="h-full w-full rounded-2xl border p-3.5 shadow-xs transition-shadow hover:shadow-md"
            style={{ backgroundImage: `linear-gradient(160deg, ${tint(t.accent, 13)}, transparent 72%)`, borderColor: tint(t.accent, 22) }}
          >
            <IconChip icon={t.icon} accent={t.accent} className="size-8" />
            <div className="mt-2.5 text-2xl font-extrabold leading-tight tabular-nums" style={{ color: accentVar(t.accent) }}>
              {loading ? <Skeleton className="h-7 w-10" /> : <CountUp value={t.value} />}
            </div>
            <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
          </div>
        </motion.div>
      ))}
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

export function MeasurementsInsights({ members, loading }: { members: MeasuredMember[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-60 w-full rounded-2xl" />)}
      </section>
    );
  }

  const branchCounts = new Map<string, number>();
  members.forEach((m) => branchCounts.set(m.member.branch.name, (branchCounts.get(m.member.branch.name) ?? 0) + 1));
  const branchRows = [...branchCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count }));

  const trainerCounts = new Map<string, number>();
  members.forEach((m) => {
    const key = m.member.trainer?.name ?? 'Unassigned';
    trainerCounts.set(key, (trainerCounts.get(key) ?? 0) + 1);
  });
  const trainerRows = [...trainerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count }));

  const stale = [...members]
    .filter((m) => daysSince(m.latest.recordedAt) > STALE_DAYS)
    .sort((a, b) => daysSince(b.latest.recordedAt) - daysSince(a.latest.recordedAt))
    .slice(0, 6);

  return (
    <section aria-label="Measurement reports" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <PanelCard icon={Building2} accent="primary" title="By branch" delay={0.2}>
        <BarRows rows={branchRows} accent="primary" />
      </PanelCard>

      <PanelCard icon={Users} accent="violet" title="By trainer" delay={0.26}>
        <BarRows rows={trainerRows} accent="violet" />
      </PanelCard>

      <PanelCard icon={CalendarClock} accent="warning" title={`Not measured in ${STALE_DAYS}+ days`} delay={0.32}>
        {stale.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everyone&apos;s up to date.</p>
        ) : (
          <ul className="space-y-0.5">
            {stale.map((m, i) => (
              <motion.li key={m.member.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}>
                <Link href={`/measurements/${m.member.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-accent/50">
                  <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar('warning')}, var(--chart-7))` }}>
                    {m.member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <b className="block truncate text-[12.5px] font-semibold">{m.member.name}</b>
                    <small className="text-muted-foreground">{daysSince(m.latest.recordedAt)} days ago</small>
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </PanelCard>
    </section>
  );
}
