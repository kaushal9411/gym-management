'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Droplets, Flame, Lightbulb, Target, Trophy, TriangleAlert, Beef, Zap, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { INSIGHT_TONE, fmtNum, r0, r1, shortDate, weekdayShort, type DietInsight, type DietNutrition, type NutritionDay } from '../../lib/diet-nutrition';
import { EmptyBlock, SectionCard, StaggerGroup, StatTile, toneChipStyle, toneColor, toneTint } from '../kit';
import { FilterChips } from '../training/chips';
import { Pop, useBounce } from './motion-bits';

const INSIGHT_ICON: Record<DietInsight['tone'], LucideIcon> = { good: Trophy, warn: TriangleAlert, tip: Lightbulb };

/** "What to do next": rule-based advice computed by the API from the member's real logs (identical on web and mobile). */
export function InsightsCard({ insights }: { insights: DietInsight[] }) {
  return (
    <SectionCard title="What to do next" subtitle="Based on what you've logged" icon={Target} tone="violet">
      {insights.length === 0 ? (
        <EmptyBlock compact icon={Lightbulb} tone="violet" title="Nothing to flag" description="Keep logging - tips show up here as your week fills in." />
      ) : (
        <ul className="space-y-3">
          {insights.map((ins, i) => {
            const tone = INSIGHT_TONE[ins.tone];
            const Icon = INSIGHT_ICON[ins.tone];
            return (
              <li key={ins.id}>
                <Pop delay={0.07 * i}>
                  <div className="flex gap-3 rounded-2xl border p-3.5" style={{ background: `linear-gradient(135deg, ${toneTint(tone, 12)}, transparent 80%)`, borderColor: toneTint(tone, 35) }}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={toneChipStyle(tone)}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{ins.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ins.body}</p>
                    </div>
                  </div>
                </Pop>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/** Weekly summary tiles: adherence, average calories / protein / water, streak - every number comes from logged days. */
export function WeekTiles({ nutrition }: { nutrition: DietNutrition }) {
  const w = nutrition.week;
  const avg = w.avgEaten;
  return (
    <StaggerGroup className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatTile
        label="Meals completed"
        value={w.adherencePct ?? '—'}
        format={(n) => `${Math.round(n)}%`}
        icon={Target}
        tone="success"
        progress={w.adherencePct ?? undefined}
        hint={w.countedDays > 0 ? `${w.mealsCompleted} of ${w.mealsPlanned} · last ${w.countedDays} d` : 'No days to count yet'}
      />
      <StatTile label="Avg calories" value={avg ? avg.calories : '—'} format={(n) => `${fmtNum(r0(n))}`} icon={Flame} tone="orange" hint={avg ? `kcal · ${w.avgDays} logged day${w.avgDays === 1 ? '' : 's'}` : 'Log a meal'} />
      <StatTile label="Avg protein" value={avg ? avg.protein : '—'} format={(n) => `${fmtNum(r1(n))} g`} icon={Beef} tone="info" hint={nutrition.planned.protein > 0 ? `plan ${fmtNum(r1(nutrition.planned.protein))} g / day` : 'per logged day'} />
      <StatTile
        label="Avg water"
        value={w.avgWaterMl ?? '—'}
        format={(n) => `${fmtNum(r0(n))} ml`}
        icon={Droplets}
        tone="primary"
        progress={w.avgWaterMl !== null ? (w.avgWaterMl / nutrition.waterTargetMl) * 100 : undefined}
        hint={w.avgWaterMl !== null ? `${w.waterDays} day${w.waterDays === 1 ? '' : 's'} saved` : 'Not saved yet'}
      />
      <StatTile label="Streak" value={nutrition.streakDays} format={(n) => `${Math.round(n)} day${Math.round(n) === 1 ? '' : 's'}`} icon={Zap} tone="violet" hint="every meal completed" />
    </StaggerGroup>
  );
}

/** Meals-completed bars for the last 7 / 14 days. Tapping a bar selects that day (when it is loggable). */
export function AdherenceChart({ days, today, selected, loggableFrom, onPick }: { days: NutritionDay[]; today: string; selected: string; loggableFrom: string; onPick: (d: string) => void }) {
  const [range, setRange] = React.useState<'7' | '14'>('7');
  const b = useBounce();
  const shown = days.slice(-Number(range));
  return (
    <SectionCard title="Daily adherence" subtitle="Meals completed per day" icon={Target} tone="success">
      <FilterChips label="Range" value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }]} />
      {shown.length === 0 ? (
        <EmptyBlock compact icon={Target} tone="success" title="No days yet" />
      ) : (
        <div className="mt-4 flex h-36 items-end gap-1.5" role="group" aria-label="Meals completed per day">
          {shown.map((d, i) => {
            const frac = d.mealsPlanned > 0 ? d.mealsCompleted / d.mealsPlanned : 0;
            const tone = d.allDone ? 'success' : frac > 0 ? 'warning' : 'muted';
            const loggable = d.date >= loggableFrom;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!loggable}
                onClick={() => onPick(d.date)}
                aria-label={`${shortDate(d.date)}: ${d.mealsCompleted} of ${d.mealsPlanned} meals completed`}
                className={cn('group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 focus-visible:outline-none', !loggable && 'cursor-default')}
              >
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{d.mealsCompleted}/{d.mealsPlanned}</span>
                <span className="relative flex w-full flex-1 items-end overflow-hidden rounded-lg bg-muted/70">
                  <motion.span
                    className="w-full rounded-lg"
                    style={{ background: frac > 0 ? `linear-gradient(180deg, color-mix(in oklab, ${toneColor(tone)} 60%, white), ${toneColor(tone)})` : 'transparent', transformOrigin: 'bottom', height: `${Math.max(frac * 100, frac > 0 ? 8 : 0)}%` }}
                    initial={{ scaleY: b.reduce ? 1 : 0 }}
                    animate={{ scaleY: 1 }}
                    transition={b.reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 11, delay: 0.04 * i }}
                  />
                </span>
                <span className={cn('rounded-md px-1 text-[10px] font-medium', d.date === selected ? 'bg-primary text-primary-foreground' : d.date === today ? 'text-primary' : 'text-muted-foreground')}>{weekdayShort(d.date).slice(0, range === '7' ? 3 : 1)}</span>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
