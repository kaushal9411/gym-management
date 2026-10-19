'use client';

import * as React from 'react';
import { Flame, MessageSquareQuote, Salad, Scale, Utensils } from 'lucide-react';
import { toast } from 'sonner';

import { useLogDiet, useMemberDiet } from '../../hooks/use-member-portal';
import { fmtNum, mealLabel, shortDate, type MealStatus } from '../../lib/diet-nutrition';
import { formatDate } from '../../lib/format';
import { ChartLegend, TrendChart } from '../charts/trend-chart';
import { DayStrip } from '../diet/day-strip';
import { AdherenceChart, InsightsCard, WeekTiles } from '../diet/insights-and-week';
import { MealCards } from '../diet/meal-cards';
import { NutritionCard } from '../diet/nutrition-card';
import { WaterCard, WeightNotesCard } from '../diet/water-weight-cards';
import { EmptyBlock, HeroChip, PortalHero, ProgressRing, SectionCard, SkeletonCard, SkeletonHero } from '../kit';

/**
 * Member diet tracker: log meals / water / weight per day (today + the last 6 days), see what you
 * ate (calories, protein, carbs, fat, fibre, sugar, sodium) against your plan, a 7/14-day
 * adherence chart, and rule-based advice. Every number is derived by the API (`nutrition` block of
 * GET /portal/diet) from real logs and plan foods - nothing is estimated on the client. "Today" is
 * the server's branch-local date, not the device clock.
 */
export function DietPageContent() {
  const { data: diet, isLoading } = useMemberDiet();
  const logDiet = useLogDiet();
  const [picked, setPicked] = React.useState<string | null>(null);

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
          <EmptyBlock icon={Salad} tone="success" title="No diet plan assigned" description="Ask your trainer to assign you one - your meals and daily log will appear here." />
        </SectionCard>
      </div>
    );
  }

  const n = diet.nutrition;
  const loggable = n.days.slice(-7);
  const selected = picked && loggable.some((d) => d.date === picked) ? picked : n.today;
  const day = n.days.find((d) => d.date === selected);
  const todayEntry = n.days.find((d) => d.date === n.today);
  const isToday = selected === n.today;
  const log = diet.dailyLogs.find((l) => l.date === selected);
  const pendingMeal = logDiet.isPending ? Object.keys(logDiet.variables?.input.mealsStatus ?? {})[0] ?? null : null;

  const save = (input: { waterIntakeMl?: number; weightKg?: number; mealsStatus?: Record<string, MealStatus>; notes?: string }, okMessage?: string) =>
    logDiet.mutate(
      { assignmentId: diet.id, input: { date: selected, ...input } },
      {
        onSuccess: () => {
          if (okMessage) toast.success(okMessage);
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not save. Please try again.'),
      },
    );

  const mealsDone = todayEntry?.mealsCompleted ?? 0;
  const mealsTotal = todayEntry?.mealsPlanned ?? n.meals.length;
  const mealPct = mealsTotal > 0 ? Math.round((mealsDone / mealsTotal) * 100) : 0;

  const hero = (
    <PortalHero
      eyebrow="Diet plan"
      title={diet.dietPlan.name}
      subtitle={`${diet.dietPlan.durationDays} days · ${n.meals.length} meals a day${n.calorieTarget ? ` · ${fmtNum(n.calorieTarget)} kcal target` : ''}`}
      chips={
        <>
          <HeroChip>{todayEntry?.logged ? '✓ Logged today' : 'Not logged today'}</HeroChip>
          <HeroChip>Started {formatDate(diet.startDate)}</HeroChip>
          {diet.endDate ? <HeroChip>Ends {formatDate(diet.endDate)}</HeroChip> : null}
        </>
      }
      aside={
        <ProgressRing value={mealPct} size={84} thickness={9} onDark>
          <span className="text-center text-xs font-semibold leading-tight tabular-nums">
            {mealsDone}/{mealsTotal}
            <br />
            <span className="font-normal text-white/75">meals</span>
          </span>
        </ProgressRing>
      }
      stats={[
        { label: 'Streak', value: n.streakDays, format: (v) => `${Math.round(v)}d` },
        { label: 'Water', value: todayEntry?.waterMl ?? 0, format: (v) => `${Math.round(v)} ml` },
        { label: 'Week', value: n.week.adherencePct ?? 0, format: (v) => `${Math.round(v)}%`, hidden: n.week.adherencePct === null },
      ]}
    />
  );

  if (!n.planStarted || !day) {
    return (
      <div className="space-y-4">
        {hero}
        <SectionCard title="Starts soon" icon={Utensils} tone="success">
          <EmptyBlock icon={Utensils} tone="success" title={`Your plan starts on ${formatDate(diet.startDate)}`} description="You can log meals, water and weight from that day." />
        </SectionCard>
      </div>
    );
  }

  const calorieRows = n.days.filter((d) => d.mealsCompleted + d.mealsSkipped > 0).map((d) => ({ label: shortDate(d.date), eaten: d.eaten.calories, planned: n.planned.calories || null }));
  const weightRows = n.days.filter((d) => d.weightKg !== null).map((d) => ({ label: shortDate(d.date), weight: d.weightKg }));
  const calorieSeries = [
    { key: 'eaten', label: 'Eaten', tone: 'orange' as const },
    ...(n.planned.calories > 0 ? [{ key: 'planned', label: 'Planned', tone: 'muted' as const }] : []),
  ];

  return (
    <div className="space-y-4">
      {hero}

      {diet.trainerRemarks ? (
        <SectionCard title="Trainer remarks" icon={MessageSquareQuote} tone="warning">
          <p className="whitespace-pre-line text-sm leading-relaxed">{diet.trainerRemarks}</p>
        </SectionCard>
      ) : null}

      <DayStrip days={loggable} today={n.today} selected={selected} onSelect={setPicked} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <NutritionCard nutrition={n} day={day} isToday={isToday} />
          <MealCards
            meals={n.meals}
            day={day}
            pendingMeal={pendingMeal}
            disabled={logDiet.isPending}
            subtitle={`${day.mealsCompleted} of ${day.mealsPlanned} done${isToday ? '' : ` · ${shortDate(day.date)}`}`}
            onSet={(mealType, status) => save({ mealsStatus: { [mealType]: status } }, status === 'COMPLETED' ? `${mealLabel(mealType)} done` : undefined)}
          />
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <InsightsCard insights={n.insights} />
          <WaterCard waterMl={day.waterMl ?? 0} targetMl={n.waterTargetMl} targetIsDefault={n.waterTargetIsDefault} disabled={logDiet.isPending} onSet={(total) => save({ waterIntakeMl: total })} />
          <WeightNotesCard key={selected} weightKg={log?.weightKg ?? null} notes={log?.notes ?? null} disabled={logDiet.isPending} onSave={(v) => save(v, 'Saved')} />
        </div>
      </div>

      <WeekTiles nutrition={n} />

      <AdherenceChart days={n.days} today={n.today} selected={selected} loggableFrom={loggable[0]?.date ?? n.today} onPick={setPicked} />

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Calories eaten" subtitle="Days you marked meals" icon={Flame} tone="orange">
          {calorieRows.length >= 2 ? (
            <>
              <TrendChart data={calorieRows} series={calorieSeries} unit=" kcal" domainPad={false} />
              <ChartLegend series={calorieSeries} />
            </>
          ) : (
            <EmptyBlock compact icon={Flame} tone="orange" title="Mark meals on 2+ days to see a trend" />
          )}
        </SectionCard>
        <SectionCard title="Weight trend" subtitle="From your daily logs" icon={Scale} tone="violet">
          {weightRows.length >= 2 ? (
            <>
              <TrendChart data={weightRows} series={[{ key: 'weight', label: 'Weight', tone: 'violet' }]} unit=" kg" />
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
