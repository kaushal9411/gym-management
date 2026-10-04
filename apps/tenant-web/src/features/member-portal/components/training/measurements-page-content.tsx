'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Activity, ArrowDownRight, ArrowUpRight, ChevronDown, GitCompareArrows, Percent, Ruler, Scale, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BodyMeasurement } from '@/features/measurements/types';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useMemberMeasurements } from '../../hooks/use-member-portal';
import { formatDate } from '../../lib/format';
import { ChartLegend, TrendChart, type TrendSeries } from '../charts/trend-chart';
import { EmptyBlock, HeroChip, PortalHero, SectionCard, SkeletonCard, SkeletonHero, StaggerGroup, StatTile, StatusChip, toneColor, toneTint, type PortalTone } from '../kit';
import { FilterChips } from './chips';

type Field = 'weightKg' | 'heightCm' | 'bodyFatPercent' | 'chestCm' | 'waistCm' | 'hipsCm' | 'bicepsCm' | 'thighsCm';
const FIELDS: { key: Field; label: string; unit: string; tone: PortalTone; lowerIsBetter?: boolean }[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', tone: 'primary' },
  { key: 'bodyFatPercent', label: 'Body fat', unit: '%', tone: 'orange', lowerIsBetter: true },
  { key: 'chestCm', label: 'Chest', unit: 'cm', tone: 'info' },
  { key: 'waistCm', label: 'Waist', unit: 'cm', tone: 'danger', lowerIsBetter: true },
  { key: 'hipsCm', label: 'Hips', unit: 'cm', tone: 'violet' },
  { key: 'bicepsCm', label: 'Biceps', unit: 'cm', tone: 'orange' },
  { key: 'thighsCm', label: 'Thighs', unit: 'cm', tone: 'warning' },
  { key: 'heightCm', label: 'Height', unit: 'cm', tone: 'muted' },
];
const GIRTHS = FIELDS.filter((f) => ['chestCm', 'waistCm', 'hipsCm', 'bicepsCm', 'thighsCm'].includes(f.key));
const RANGES = [
  { value: '30', label: '1M' },
  { value: '90', label: '3M' },
  { value: '180', label: '6M' },
  { value: 'all', label: 'All' },
];

const num = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Delta({ diff, unit, lowerIsBetter }: { diff: number | null; unit: string; lowerIsBetter?: boolean }) {
  if (diff === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (diff === 0) return <StatusChip tone="muted">No change</StatusChip>;
  const good = lowerIsBetter === undefined ? null : lowerIsBetter ? diff < 0 : diff > 0;
  const tone: PortalTone = good === null ? 'info' : good ? 'success' : 'danger';
  return (
    <StatusChip tone={tone} className="gap-0.5">
      {diff > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(diff)} {unit}
    </StatusChip>
  );
}

export function MeasurementsPageContent() {
  const { data, isLoading } = useMemberMeasurements();
  const m = useMotionSafe();
  const [range, setRange] = React.useState('all');
  const [open, setOpen] = React.useState<string | null>(null);
  // (analysis below uses `valued`, history uses every row)

  const asc = React.useMemo(() => [...(data ?? [])].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)), [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
      </div>
    );
  }
  // Check-ins with no recorded value at all can't be analysed; they stay visible in History only.
  const hasAny = (e: BodyMeasurement) => FIELDS.some((f) => num(e[f.key]) !== null);
  const valued = asc.filter(hasAny);
  const first = valued[0];
  const latest = valued.at(-1);
  if (!first || !latest) {
    return (
      <div className="space-y-4">
        <PortalHero eyebrow="Body measurements" title="No check-ins yet" subtitle="Your trainer logs them for you" />
        <SectionCard title="Progress" icon={Ruler} tone="primary">
          <EmptyBlock icon={Ruler} title="No measurements yet" description="Ask your trainer to log your first check-in — your trends and comparisons will appear here." />
        </SectionCard>
      </div>
    );
  }

  const prev = valued.length > 1 ? (valued[valued.length - 2] ?? null) : null;
  const val = (e: BodyMeasurement | null, k: Field) => (e ? num(e[k]) : null);
  const diffOf = (a: BodyMeasurement | null, b: BodyMeasurement | null, k: Field) => {
    const x = val(a, k);
    const y = val(b, k);
    return x === null || y === null ? null : r1(x - y);
  };
  // BMI is computed client-side from real weight + the most recent recorded height (not a stored value).
  const heightLatest = [...asc].reverse().map((e) => num(e.heightCm)).find((h) => h !== null) ?? null;
  const bmiOf = (e: BodyMeasurement | null) => {
    const w = val(e, 'weightKg');
    const h = num(e?.heightCm) ?? heightLatest;
    return w !== null && h ? r1(w / ((h / 100) ** 2)) : null;
  };
  const bmi = bmiOf(latest);
  const bmiBand = bmi === null ? null : bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy range' : bmi < 30 ? 'Overweight' : 'Obese';
  const bmiTone: PortalTone = bmi === null ? 'muted' : bmi < 18.5 ? 'info' : bmi < 25 ? 'success' : bmi < 30 ? 'warning' : 'danger';
  const w = val(latest, 'weightKg');
  const bf = val(latest, 'bodyFatPercent');

  const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86_400_000;
  const inRange = valued.filter((e) => new Date(e.recordedAt).getTime() >= cutoff);
  const rows = (k: Field) => inRange.filter((e) => num(e[k]) !== null).map((e) => ({ label: dateLabel(e.recordedAt), [k]: num(e[k]) }));
  const weightRows = rows('weightKg');
  const fatRows = rows('bodyFatPercent');
  const girthSeries: TrendSeries[] = GIRTHS.filter((f) => inRange.some((e) => num(e[f.key]) !== null)).map((f) => ({ key: f.key, label: f.label, tone: f.tone }));
  const girthRows = inRange.map((e) => ({ label: dateLabel(e.recordedAt), ...Object.fromEntries(GIRTHS.map((f) => [f.key, num(e[f.key])])) }));
  const compare = FIELDS.filter((f) => val(first, f.key) !== null || val(latest, f.key) !== null);
  const history = [...asc].reverse();

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Body measurements"
        title={w !== null ? `${w} kg` : 'Latest check-in'}
        subtitle={`Latest check-in ${formatDate(latest.recordedAt)}${latest.recordedBy ? ` · by ${latest.recordedBy.name}` : ''}`}
        chips={
          <>
            <HeroChip>{asc.length} check-in{asc.length === 1 ? '' : 's'}</HeroChip>
            {diffOf(latest, prev, 'weightKg') ? (
              <HeroChip>
                {(diffOf(latest, prev, 'weightKg') ?? 0) > 0 ? '▲' : '▼'} {Math.abs(diffOf(latest, prev, 'weightKg') ?? 0)} kg vs previous
              </HeroChip>
            ) : null}
            {valued.length > 1 && diffOf(latest, first, 'weightKg') ? <HeroChip>{(diffOf(latest, first, 'weightKg') ?? 0) > 0 ? '+' : ''}{diffOf(latest, first, 'weightKg')} kg since first</HeroChip> : null}
          </>
        }
        stats={[
          { label: 'BMI (computed)', value: bmi ?? '—', format: (n) => n.toFixed(1), hidden: bmi === null },
          { label: 'Body fat', value: bf ?? 0, format: (n) => `${n}%`, hidden: bf === null },
          { label: 'Waist', value: val(latest, 'waistCm') ?? 0, format: (n) => `${n} cm`, hidden: val(latest, 'waistCm') === null },
        ]}
      />

      <StaggerGroup className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {w !== null ? <StatTile label="Weight" value={w} format={(n) => `${r1(n)} kg`} icon={Scale} tone="primary" hint={prev && diffOf(latest, prev, 'weightKg') !== null ? `${(diffOf(latest, prev, 'weightKg') ?? 0) > 0 ? '+' : ''}${diffOf(latest, prev, 'weightKg')} kg vs previous` : 'Latest'} /> : null}
        {bmi !== null ? <StatTile label="BMI (computed)" value={bmi} format={(n) => n.toFixed(1)} icon={Activity} tone={bmiTone} hint={`${bmiBand} · from weight & height`} /> : null}
        {bf !== null ? <StatTile label="Body fat" value={bf} format={(n) => `${n}%`} icon={Percent} tone="orange" hint={prev && diffOf(latest, prev, 'bodyFatPercent') !== null ? `${(diffOf(latest, prev, 'bodyFatPercent') ?? 0) > 0 ? '+' : ''}${diffOf(latest, prev, 'bodyFatPercent')}% vs previous` : 'Latest'} /> : null}
        {valued.length > 1 && diffOf(latest, first, 'weightKg') !== null ? (
          <StatTile label="Since first" value={diffOf(latest, first, 'weightKg') ?? 0} format={(n) => `${n > 0 ? '+' : ''}${r1(n)} kg`} icon={TrendingUp} tone="violet" hint={`Since ${formatDate(first.recordedAt)}`} />
        ) : (
          <StatTile label="Check-ins" value={valued.length} icon={Ruler} tone="violet" hint={`First ${formatDate(first.recordedAt)}`} />
        )}
      </StaggerGroup>

      <SectionCard title="Trends" subtitle="Plotted from each check-in" icon={TrendingUp} tone="primary">
        <FilterChips label="Range" value={range} onChange={setRange} options={RANGES} />
        <div className="mt-4 space-y-6">
          <div>
            <p className="mb-1 text-sm font-semibold">Weight (kg)</p>
            {weightRows.length >= 2 ? <TrendChart data={weightRows} series={[{ key: 'weightKg', label: 'Weight', tone: 'primary' }]} unit=" kg" /> : <EmptyBlock compact icon={Scale} title="Not enough weight check-ins in this range" />}
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">Body fat (%)</p>
            {fatRows.length >= 2 ? <TrendChart data={fatRows} series={[{ key: 'bodyFatPercent', label: 'Body fat', tone: 'orange' }]} unit="%" /> : <EmptyBlock compact icon={Percent} tone="orange" title="Not enough body-fat check-ins in this range" />}
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">Girths (cm)</p>
            {girthSeries.length > 0 && inRange.length >= 2 ? (
              <>
                <TrendChart data={girthRows} series={girthSeries} unit=" cm" height={220} />
                <ChartLegend series={girthSeries} />
              </>
            ) : (
              <EmptyBlock compact icon={Ruler} tone="violet" title="Not enough girth check-ins in this range" />
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="First vs latest" subtitle={valued.length > 1 ? `${formatDate(first.recordedAt)} → ${formatDate(latest.recordedAt)}` : 'Needs two check-ins to compare'} icon={GitCompareArrows} tone="violet" flush>
        {valued.length < 2 ? (
          <EmptyBlock compact icon={GitCompareArrows} tone="violet" title="Only one check-in so far" description="Once you have a second one, you'll see what changed." />
        ) : (
          <ul className="divide-y">
            {compare.map((f) => (
              <li key={f.key} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: toneColor(f.tone) }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.label}</p>
                  <p className="truncate text-xs tabular-nums text-muted-foreground">
                    {val(first, f.key) ?? '—'} → <span className="font-semibold text-foreground">{val(latest, f.key) ?? '—'}</span> {f.unit}
                  </p>
                </div>
                <Delta diff={diffOf(latest, first, f.key)} unit={f.unit} lowerIsBetter={f.lowerIsBetter} />
              </li>
            ))}
            {bmiOf(first) !== null && bmi !== null ? (
              <li className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: toneColor('success') }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">BMI (computed)</p>
                  <p className="truncate text-xs tabular-nums text-muted-foreground">
                    {bmiOf(first)} → <span className="font-semibold text-foreground">{bmi}</span>
                  </p>
                </div>
                <Delta diff={r1(bmi - (bmiOf(first) ?? 0))} unit="" />
              </li>
            ) : null}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="History" subtitle="Tap a check-in for every value" icon={Ruler} tone="info">
        <div className="space-y-3">
          {history.map((e, idx) => {
            const isOpen = open === e.id;
            const vals = FIELDS.filter((f) => num(e[f.key]) !== null);
            const headline = vals.slice(0, 3);
            return (
              <motion.div key={e.id} initial={m.reduce ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: Math.min(idx, 5) * 0.04 }} className="overflow-hidden rounded-2xl border bg-card">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{formatDate(e.recordedAt)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {headline.length ? headline.map((f) => `${f.label} ${num(e[f.key])}${f.unit === '%' ? '%' : ` ${f.unit}`}`).join(' · ') : 'No values recorded'}
                    </p>
                  </div>
                  {idx === 0 ? <StatusChip tone="success">Latest</StatusChip> : null}
                  <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} aria-hidden />
                </button>
                {isOpen ? (
                  <motion.div initial={m.reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="border-t px-4 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      {vals.map((f) => (
                        <div key={f.key} className="min-w-0 rounded-xl px-3 py-2" style={{ background: toneTint(f.tone, 10) }}>
                          <p className="truncate text-[11px] font-medium text-muted-foreground">{f.label}</p>
                          <p className="truncate text-sm font-semibold tabular-nums">
                            {num(e[f.key])} <span className="text-xs font-normal text-muted-foreground">{f.unit}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                    {e.notes ? <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">{e.notes}</p> : null}
                    {e.recordedBy ? <p className="mt-2 text-[11px] text-muted-foreground">Logged by {e.recordedBy.name}</p> : null}
                  </motion.div>
                ) : null}
              </motion.div>
            );
          })}
        </div>
        {/* Read-only on purpose: members never edit measurements; only staff log them. */}
      </SectionCard>
    </div>
  );
}
