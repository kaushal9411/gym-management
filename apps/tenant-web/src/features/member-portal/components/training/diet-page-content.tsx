'use client';

import * as React from 'react';
import { Check, Droplets, Flame, MessageSquareQuote, Minus, Plus, Salad, Scale, SkipForward, Utensils } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useLogDiet, useMemberDiet } from '../../hooks/use-member-portal';
import { formatDate } from '../../lib/format';
import { ChartLegend, TrendChart } from '../charts/trend-chart';
import { EmptyBlock, HeroChip, PortalHero, ProgressRing, SectionCard, SkeletonCard, SkeletonHero, StaggerGroup, StatTile, StatusChip, toneColor, toneTint } from '../kit';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
const meal = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function DietPageContent() {
  const { data: diet, isLoading } = useMemberDiet();
  const logDiet = useLogDiet();
  const today = todayStr();
  const todaysLog = diet?.dailyLogs.find((l) => l.date === today);
  const [water, setWater] = React.useState('');
  const [weight, setWeight] = React.useState('');

  const logs = React.useMemo(() => [...(diet?.dailyLogs ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [diet]);
  const streak = React.useMemo(() => {
    const dates = new Set(logs.map((l) => l.date));
    let n = 0;
    const d = new Date(`${todayStr()}T00:00:00Z`);
    if (!dates.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1); // today not logged yet doesn't break the streak
    while (dates.has(d.toISOString().slice(0, 10))) {
      n += 1;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return n;
  }, [logs]);
  const last14 = React.useMemo(() => {
    const dates = new Set(logs.map((l) => l.date));
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(`${todayStr()}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      return { key, on: dates.has(key) };
    });
  }, [logs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
      </div>
    );
  }
  if (!diet) {
    return (
      <div className="space-y-4">
        <PortalHero eyebrow="Diet" title="No diet plan yet" subtitle="Your trainer will set one up for you" />
        <SectionCard title="Your plan" icon={Salad} tone="success">
          <EmptyBlock icon={Salad} tone="success" title="No diet plan assigned" description="Ask your trainer to assign you one — your meals and daily log will appear here." />
        </SectionCard>
      </div>
    );
  }

  const mealsStatus = (todaysLog?.mealsStatus ?? {}) as Record<string, string>;
  const mealTypes = diet.dietPlan.mealTypes;
  const mealsDone = mealTypes.filter((t) => mealsStatus[t] === 'COMPLETED').length;
  const mealPct = mealTypes.length ? Math.round((mealsDone / mealTypes.length) * 100) : 0;
  const waterNow = Number(water || todaysLog?.waterIntakeMl || 0);
  const bump = (n: number) => setWater(String(Math.max(0, waterNow + n)));
  const waterData = logs.filter((l) => l.waterIntakeMl !== null).slice(-14).map((l) => ({ label: short(l.date), water: l.waterIntakeMl }));
  const weightData = logs.filter((l) => l.weightKg !== null).slice(-14).map((l) => ({ label: short(l.date), weight: Number(l.weightKg) }));
  const logged = Boolean(todaysLog);

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Diet plan"
        title={diet.dietPlan.name}
        subtitle={`${diet.dietPlan.durationDays} days · ${mealTypes.length} meals a day`}
        chips={
          <>
            <HeroChip>{logged ? '✓ Logged today' : 'Not logged today'}</HeroChip>
            <HeroChip>Started {formatDate(diet.startDate)}</HeroChip>
            {diet.endDate ? <HeroChip>Ends {formatDate(diet.endDate)}</HeroChip> : null}
          </>
        }
        aside={
          <ProgressRing value={mealPct} size={84} thickness={9} onDark>
            <span className="text-center text-xs font-semibold leading-tight tabular-nums">
              {mealsDone}/{mealTypes.length}
              <br />
              <span className="font-normal text-white/75">meals</span>
            </span>
          </ProgressRing>
        }
        stats={[
          { label: 'Kcal / day', value: diet.dietPlan.dailyCalories ?? 0, hidden: !diet.dietPlan.dailyCalories },
          { label: 'Water', value: todaysLog?.waterIntakeMl ?? 0, format: (n) => `${n} ml` },
          { label: 'Streak', value: streak, format: (n) => `${n}d` },
        ]}
      />

      <StaggerGroup className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Daily calories" value={diet.dietPlan.dailyCalories ?? '—'} format={(n) => `${n}`} icon={Flame} tone="orange" hint="kcal target" />
        <StatTile label="Meals today" value={mealsDone} format={(n) => `${n}/${mealTypes.length}`} icon={Utensils} tone="success" progress={mealPct} hint="Marked done" />
        <StatTile label="Water today" value={todaysLog?.waterIntakeMl ?? 0} format={(n) => `${n} ml`} icon={Droplets} tone="info" hint={todaysLog?.waterIntakeMl ? 'Saved' : 'Not saved yet'} />
        <StatTile label="Logging streak" value={streak} format={(n) => `${n} day${n === 1 ? '' : 's'}`} icon={Check} tone="violet" hint={`${logs.length} days logged`} />
      </StaggerGroup>

      {diet.trainerRemarks ? (
        <SectionCard title="Trainer remarks" icon={MessageSquareQuote} tone="warning">
          <p className="whitespace-pre-line text-sm leading-relaxed">{diet.trainerRemarks}</p>
        </SectionCard>
      ) : null}

      <SectionCard title="Today's meals" subtitle={`${mealsDone} of ${mealTypes.length} done`} icon={Utensils} tone="success">
        <div className="space-y-3">
          {mealTypes.map((mealType) => {
            const status = mealsStatus[mealType];
            const tone = status === 'COMPLETED' ? 'success' : status === 'SKIPPED' ? 'muted' : 'primary';
            return (
              <div key={mealType} className="rounded-2xl border p-3.5 transition-colors" style={status ? { background: toneTint(tone, 10), borderColor: toneTint(tone, 40) } : undefined}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: toneTint(tone, 18), color: toneColor(tone) }}>
                    {status === 'COMPLETED' ? <Check className="size-5" /> : status === 'SKIPPED' ? <SkipForward className="size-5" /> : <Utensils className="size-5" />}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{meal(mealType)}</p>
                  {status ? <StatusChip tone={tone}>{status === 'COMPLETED' ? 'Done' : 'Skipped'}</StatusChip> : null}
                </div>
                {!status ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-label={`Mark ${mealType} done`}
                      disabled={logDiet.isPending}
                      onClick={() => logDiet.mutate({ assignmentId: diet.id, input: { date: today, mealsStatus: { [mealType]: 'COMPLETED' } } })}
                      className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-success text-sm font-semibold text-white shadow-sm transition active:scale-[0.97] disabled:opacity-60"
                    >
                      <Check className="size-4" /> Done
                    </button>
                    <button
                      type="button"
                      aria-label={`Mark ${mealType} skipped`}
                      disabled={logDiet.isPending}
                      onClick={() => logDiet.mutate({ assignmentId: diet.id, input: { date: today, mealsStatus: { [mealType]: 'SKIPPED' } } })}
                      className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-semibold text-muted-foreground transition active:scale-[0.97] hover:bg-accent disabled:opacity-60"
                    >
                      <SkipForward className="size-4" /> Skip
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {/* Dropped: per-meal foods/macros — the member diet endpoint only exposes meal type names and the daily kcal target. */}
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Water" subtitle={todaysLog?.waterIntakeMl ? `Saved today: ${todaysLog.waterIntakeMl} ml` : 'Nothing saved today'} icon={Droplets} tone="info">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Decrease water by 250 ml" onClick={() => bump(-250)} className="grid size-12 shrink-0 place-items-center rounded-xl border transition active:scale-95 hover:bg-accent">
              <Minus className="size-5" />
            </button>
            <div className="relative min-w-0 flex-1">
              <label htmlFor="water" className="sr-only">
                Water intake (ml)
              </label>
              <input
                id="water"
                type="number"
                inputMode="numeric"
                min={0}
                value={water}
                onChange={(e) => setWater(e.target.value)}
                placeholder={todaysLog?.waterIntakeMl?.toString() ?? '0'}
                className="h-12 w-full rounded-xl border bg-background px-3 pr-10 text-center text-lg font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ml</span>
            </div>
            <button type="button" aria-label="Increase water by 250 ml" onClick={() => bump(250)} className="grid size-12 shrink-0 place-items-center rounded-xl border transition active:scale-95 hover:bg-accent">
              <Plus className="size-5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[250, 500].map((n) => (
              <button key={n} type="button" onClick={() => bump(n)} className="min-h-11 rounded-xl text-sm font-semibold transition active:scale-95" style={{ background: toneTint('info', 15), color: toneColor('info') }}>
                +{n} ml
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={logDiet.isPending || !water}
            onClick={() => {
              logDiet.mutate({ assignmentId: diet.id, input: { date: today, waterIntakeMl: Number(water) } });
              setWater('');
            }}
            className="mt-3 min-h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            Save water
          </button>
        </SectionCard>

        <SectionCard title="Weight" subtitle={todaysLog?.weightKg ? `Saved today: ${todaysLog.weightKg} kg` : 'Nothing saved today'} icon={Scale} tone="violet">
          <label htmlFor="weight" className="sr-only">
            Weight (kg)
          </label>
          <div className="relative">
            <input
              id="weight"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={todaysLog?.weightKg ?? '0'}
              className="h-12 w-full rounded-xl border bg-background px-3 pr-10 text-center text-lg font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
          </div>
          <button
            type="button"
            disabled={logDiet.isPending || !weight}
            onClick={() => {
              logDiet.mutate({ assignmentId: diet.id, input: { date: today, weightKg: Number(weight) } });
              setWeight('');
            }}
            className="mt-3 min-h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            Save weight
          </button>
        </SectionCard>
      </div>

      <SectionCard title="Logging streak" subtitle={`${streak} day${streak === 1 ? '' : 's'} in a row · last 14 days`} icon={Check} tone="violet">
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
          {last14.map((d) => (
            <span key={d.key} title={`${short(d.key)}: ${d.on ? 'logged' : 'not logged'}`} className={cn('aspect-square rounded-md', d.key === today && 'ring-2 ring-primary/50')} style={{ background: d.on ? toneColor('violet') : toneTint('muted', 18) }} />
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Water trend" subtitle="Last 14 logged days" icon={Droplets} tone="info">
          {waterData.length >= 2 ? <TrendChart data={waterData} series={[{ key: 'water', label: 'Water', tone: 'info' }]} unit=" ml" domainPad={false} /> : <EmptyBlock compact icon={Droplets} tone="info" title="Log water on 2+ days to see a trend" />}
        </SectionCard>
        <SectionCard title="Weight trend" subtitle="From your daily logs" icon={Scale} tone="violet">
          {weightData.length >= 2 ? (
            <>
              <TrendChart data={weightData} series={[{ key: 'weight', label: 'Weight', tone: 'violet' }]} unit=" kg" />
              <ChartLegend series={[{ key: 'weight', label: 'Weight (kg)', tone: 'violet' }]} />
            </>
          ) : (
            <EmptyBlock compact icon={Scale} tone="violet" title="Log weight on 2+ days to see a trend" />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
