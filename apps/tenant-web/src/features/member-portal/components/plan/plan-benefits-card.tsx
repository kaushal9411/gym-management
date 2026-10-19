'use client';

import { motion } from 'framer-motion';
import { Ban, CalendarRange, Check, DoorOpen, Dumbbell, KeyRound, MapPin, Minus, Salad, Snowflake, Sparkles, UserPlus, Users, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useMemberPlan } from '../../hooks/use-member-portal';
import { BENEFIT_TONE, barTone, hasQuota, includedCount, remainingPercent, termRemainingPercent, unitLabel } from '../../lib/plan-benefits';
import { formatDate } from '../../lib/format';
import type { MemberPlan, MemberPlanBenefit, MemberPlanBenefitKey } from '../../services/member-portal.service';
import { AnimatedNumber, HERO_GRADIENT, HERO_STRIPES, SkeletonCard, StaggerGroup, StaggerItem, toneChipStyle, toneColor, toneWash, type PortalTone } from '../kit';

const ICON: Record<MemberPlanBenefitKey, LucideIcon> = {
  gym_access: DoorOpen,
  pt_sessions: Dumbbell,
  group_classes: Users,
  diet_consultation: Salad,
  locker: KeyRound,
  guest_passes: UserPlus,
  freeze: Snowflake,
};

/** Horizontal bar that fills in (static under reduced motion). `onDark` = white on translucent, for the hero. */
function Bar({ percent, color, onDark }: { percent: number; color: string; onDark?: boolean }) {
  const m = useMotionSafe();
  const pct = Math.max(2, Math.min(100, percent)) / 100;
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full', onDark ? 'bg-white/25' : 'bg-muted')} role="presentation">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color, transformOrigin: 'left' }}
        initial={{ scaleX: m.reduce ? pct : 0 }}
        animate={{ scaleX: pct }}
        transition={{ duration: m.reduce ? 0 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </div>
  );
}

function BenefitBody({ benefit: b, tone }: { benefit: MemberPlanBenefit; tone: PortalTone }) {
  if (b.key === 'gym_access') {
    return (
      <div className="mt-2">
        {b.note ? <p className="text-base font-semibold tracking-tight">{b.note}</p> : null}
        {b.items.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {b.items.map((name) => (
              <li key={name} className="inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={toneChipStyle(tone)}>
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate text-foreground">{name}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (hasQuota(b)) {
    return (
      <div className="mt-2">
        <p className="flex items-baseline gap-1">
          <AnimatedNumber value={b.remaining} className="text-2xl font-semibold tabular-nums tracking-tight" />
          <span className="text-xs font-semibold text-muted-foreground">left</span>
        </p>
        <div className="mt-1.5">
          <Bar percent={remainingPercent(b)} color={toneColor(barTone(b))} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
          {b.used} of {b.quota} {unitLabel(b.unit, b.quota)} used
        </p>
      </div>
    );
  }
  return b.note ? <p className="mt-2 truncate text-base font-semibold tracking-tight">{b.note}</p> : null;
}

function BenefitTile({ benefit: b }: { benefit: MemberPlanBenefit }) {
  const tone = BENEFIT_TONE[b.key] ?? 'primary';
  const Icon = ICON[b.key] ?? Sparkles;
  const on = b.included;
  return (
    <StaggerItem className={cn('min-w-0', b.key === 'gym_access' && 'col-span-full')}>
      <div
        className={cn('relative h-full min-w-0 overflow-hidden rounded-2xl border p-3.5', !on && 'bg-muted/40')}
        style={on ? { background: toneWash(tone), borderColor: `color-mix(in oklab, ${toneColor(tone)} 30%, transparent)` } : undefined}
        data-included={on}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="grid size-9 place-items-center rounded-xl" style={toneChipStyle(on ? tone : 'muted')}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <span className={cn('grid size-5 place-items-center rounded-full', on ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')} aria-hidden>
            {on ? <Check className="size-3.5" /> : <Minus className="size-3.5" />}
          </span>
        </div>
        <p className={cn('mt-2.5 break-words text-sm font-semibold leading-tight', !on && 'text-muted-foreground')}>{b.label}</p>
        <p className={cn('mt-0.5 text-xs font-semibold', on ? 'text-success' : 'text-muted-foreground')}>{on ? 'Included' : 'Not included'}</p>
        {on ? <BenefitBody benefit={b} tone={tone} /> : null}
      </div>
    </StaggerItem>
  );
}

function StatusChip({ plan }: { plan: MemberPlan }) {
  const expired = plan.expired || plan.status === 'EXPIRED';
  const pending = plan.status === 'PENDING';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold">
      <span className={cn('size-2 rounded-full', expired ? 'bg-destructive' : pending ? 'bg-warning' : 'bg-success')} aria-hidden />
      {expired ? 'Expired' : pending ? 'Starts soon' : 'Active'}
    </span>
  );
}

/** "What's included in your plan": tenant-gradient header (plan, code, category, duration, validity) over the benefit tiles. */
export function PlanBenefitsCard({ plan }: { plan: MemberPlan }) {
  const m = useMotionSafe();
  const daysText = plan.status === 'PENDING' ? `Starts ${formatDate(plan.startDate)}` : plan.expired ? 'Ended' : `${plan.daysLeft} ${plan.daysLeft === 1 ? 'day' : 'days'} left`;
  return (
    <motion.section
      variants={m.fadeUp}
      initial={m.initial}
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-xs"
      aria-label="What is included in your plan"
    >
      <header className="relative overflow-hidden p-5 text-white md:p-6" style={{ background: HERO_GRADIENT }}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: HERO_STRIPES }} />
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/75">Your plan</p>
            <StatusChip plan={plan} />
          </div>
          <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight md:text-3xl">{plan.name}</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[plan.code, plan.category, plan.durationLabel].filter(Boolean).map((t) => (
              <span key={t} className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-xs font-semibold">
                {t}
              </span>
            ))}
          </div>
          {plan.description ? <p className="mt-3 line-clamp-2 text-sm text-white/85">{plan.description}</p> : null}
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-white/90">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <CalendarRange className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {formatDate(plan.startDate)} → {formatDate(plan.endDate)}
                </span>
              </span>
              <span className="shrink-0 font-semibold text-white">{daysText}</span>
            </div>
            <div className="mt-2">
              <Bar percent={termRemainingPercent(plan)} color="#fff" onDark />
            </div>
          </div>
        </div>
      </header>
      <div className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">What’s included</h3>
            <p className="text-xs text-muted-foreground">For this membership period</p>
          </div>
          <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success tabular-nums">
            {includedCount(plan)} of {plan.benefits.length}
          </span>
        </div>
        <StaggerGroup step={0.05} className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {plan.benefits.map((b) => (
            <BenefitTile key={b.key} benefit={b} />
          ))}
        </StaggerGroup>
        {plan.benefits.every((b) => !b.included) ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Ban className="size-3.5" aria-hidden /> Nothing is included in this plan.
          </p>
        ) : null}
      </div>
    </motion.section>
  );
}

/** Self-loading wrapper: skeleton while loading, nothing without a membership, a quiet retry line on failure (never blocks the page it sits on). */
export function PlanBenefitsSection() {
  const { data: plan, isLoading, isError, refetch } = useMemberPlan();
  if (isLoading) return <SkeletonCard lines={3} />;
  if (isError) {
    return (
      <button type="button" onClick={() => void refetch()} className="min-h-11 w-full rounded-2xl border border-dashed px-4 text-left text-xs font-semibold text-muted-foreground hover:bg-muted/40">
        Couldn’t load what’s included in your plan - tap to retry
      </button>
    );
  }
  if (!plan) return null;
  return <PlanBenefitsCard plan={plan} />;
}
