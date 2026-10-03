'use client';

import { motion } from 'framer-motion';
import { Apple, CheckCircle2, Dumbbell, Flame, Tag, XCircle, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, CountUp, IconChip, PanelCard, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { Food } from '../types';

interface KpiTile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
  status?: 'true' | 'false' | '';
}

export function FoodsKpis({
  foods,
  loading,
  isActiveFilter,
  onStatus,
}: {
  foods: Food[];
  loading: boolean;
  isActiveFilter: 'true' | 'false' | '';
  onStatus: (v: 'true' | 'false' | '') => void;
}) {
  const live = foods.filter((f) => !f.deletedAt);
  const active = live.filter((f) => f.isActive).length;
  const inactive = live.length - active;
  const categoryCount = new Set(live.map((f) => f.category).filter(Boolean)).size;

  const tiles: KpiTile[] = [
    { key: 'total', label: 'Total foods', icon: Apple, accent: 'primary', value: foods.length, status: '' },
    { key: 'active', label: 'Active', icon: CheckCircle2, accent: 'success', value: active, status: 'true' },
    { key: 'inactive', label: 'Inactive', icon: XCircle, accent: 'warning', value: inactive, status: 'false' },
    { key: 'categories', label: 'Categories', icon: Tag, accent: 'violet', value: categoryCount },
  ];

  return (
    <section aria-label="Food figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function BarRows({ rows, accent, suffix }: { rows: Array<{ label: string; count: number }>; accent: Accent; suffix?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-[12.5px]">
            <b className="truncate pr-2 font-semibold">{r.label}</b>
            <span className="shrink-0 tabular-nums text-muted-foreground">{r.count}{suffix}</span>
          </div>
          <ProgressBar percent={(r.count / max) * 100} accent={accent} />
        </div>
      ))}
    </div>
  );
}

export function FoodsInsights({ foods, loading }: { foods: Food[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-60 w-full rounded-2xl" />)}
      </section>
    );
  }

  const live = foods.filter((f) => !f.deletedAt);

  const categoryCounts = new Map<string, number>();
  live.forEach((f) => {
    const key = f.category?.trim() || 'Uncategorized';
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  });
  const categoryRows = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count }));

  const topByCalories = [...live]
    .filter((f) => f.calories !== null)
    .sort((a, b) => (b.calories ?? 0) - (a.calories ?? 0))
    .slice(0, 6)
    .map((f) => ({ label: f.name, count: f.calories ?? 0 }));

  const topByProtein = [...live]
    .filter((f) => f.protein !== null)
    .sort((a, b) => Number(b.protein ?? 0) - Number(a.protein ?? 0))
    .slice(0, 6)
    .map((f) => ({ label: f.name, count: Math.round(Number(f.protein ?? 0)) }));

  return (
    <section aria-label="Food reports" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <PanelCard icon={Tag} accent="primary" title="By category" delay={0.2}>
        <BarRows rows={categoryRows} accent="primary" />
      </PanelCard>

      <PanelCard icon={Flame} accent="warning" title="Highest-calorie foods" delay={0.26}>
        <BarRows rows={topByCalories} accent="warning" suffix=" kcal" />
      </PanelCard>

      <PanelCard icon={Dumbbell} accent="aqua" title="Highest-protein foods" delay={0.32}>
        <BarRows rows={topByProtein} accent="aqua" suffix="g" />
      </PanelCard>
    </section>
  );
}
