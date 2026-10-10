'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Check, Flame, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { toDietError, useCreateDietPlan, useSetPlanMeals } from '@/features/diet/hooks/use-diet';
import { dietService } from '@/features/diet/services/diet.service';
import type { Food } from '@/features/diet/types';
import {
  ageOf,
  applySwap,
  DIET_LABEL,
  generate,
  GOALS,
  MISSING_LABEL,
  setQty,
  totals,
  warnings,
  type GenerateResult,
  type Plan,
  type SwapOption,
} from '@/features/diet/smart/engine';
import { SmartPlanMeals } from '@/features/diet/smart/smart-plan-meals';
import { STARTER_FOODS } from '@/features/diet/smart/starter-foods';
import { useSmartCatalog, useSmartMemberInput } from '@/features/diet/smart/use-smart-plan-input';
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import { useMemberList } from '@/features/members/hooks/use-members';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const PLAN_DAYS = 28;
const SEX_LABEL = { M: 'Male', F: 'Female', O: 'Other' } as const;
const n0 = (n: number) => Math.round(n).toLocaleString('en-US');

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function Notice({ tone, title, children }: { tone: 'warning' | 'destructive' | 'primary'; title: string; children: React.ReactNode }) {
  const c = `var(--${tone})`;
  return (
    <div className="space-y-1.5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: `color-mix(in oklch, ${c} 40%, transparent)`, backgroundColor: `color-mix(in oklch, ${c} 9%, transparent)` }}>
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="size-4" style={{ color: c }} /> {title}
      </p>
      {children}
    </div>
  );
}

export default function SmartDietPlanPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('diets:create');
  const createPlan = useCreateDietPlan();
  const setMeals = useSetPlanMeals();

  const [search, setSearch] = React.useState('');
  const debounced = useDebouncedValue(search, 300);
  const members = useMemberList({ page: 1, limit: 50, search: debounced || undefined, sortBy: 'name', sortDir: 'asc' });
  const [memberId, setMemberId] = React.useState<string | null>(null);
  const [mix, setMix] = React.useState(0);
  const [edit, setEdit] = React.useState<{ src: Plan; plan: Plan } | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { input, loading: memberLoading, error: memberError } = useSmartMemberInput(memberId);
  const { catalog, loading: catalogLoading } = useSmartCatalog();

  const result = React.useMemo<GenerateResult | null>(() => (input ? generate(input.member, catalog, mix) : null), [input, catalog, mix]);
  const base = result?.status === 'ok' ? result.plan : null;
  const plan = base && edit && edit.src === base ? edit.plan : base;

  const mutate = (fn: (copy: Plan) => void) => {
    if (!base || !plan) return;
    const copy = structuredClone(plan);
    fn(copy);
    setEdit({ src: base, plan: copy });
  };

  const addStarterFoods = async () => {
    setAdding(true);
    try {
      // Look at every food including inactive and deleted ones: the name is unique per gym, so those must be brought back, not re-created.
      const known = new Map<string, Food>();
      for (let page = 1; ; page++) {
        const res = await dietService.listFoods({ page, limit: 100, includeDeleted: true });
        res.items.forEach((f) => known.set(f.name.trim().toLowerCase(), f));
        if (page >= res.totalPages) break;
      }
      let changed = 0;
      for (const s of STARTER_FOODS) {
        const match = known.get(s.name.toLowerCase());
        if (!match) {
          await dietService.createFood({ name: s.name, category: s.category, servingSize: s.serving, calories: s.kcal, protein: s.p, carbohydrates: s.c, fat: s.f, sugar: s.sugar, sodium: s.sodium });
          changed++;
          continue;
        }
        if (match.deletedAt) {
          await dietService.restoreFood(match.id);
          changed++;
        }
        if (!match.isActive) {
          await dietService.updateFood(match.id, { isActive: true });
          if (!match.deletedAt) changed++;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['foods'] });
      toast.success(changed ? `${changed} starter foods added or restored` : 'Starter foods were already in the library');
    } catch (err) {
      toast.error(toDietError(err).message);
    } finally {
      setAdding(false);
    }
  };

  const save = async () => {
    if (!plan || !input) return;
    setError(null);
    const t = plan.t;
    const tot = totals(plan);
    const now = new Date();
    const baseName = `Smart plan - ${input.name} - ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
    const payload = {
      description: `Automatic plan for ${input.name} (${input.memberCode}).`,
      goal: t.goal.label,
      dailyCalories: Math.round(tot.kcal),
      durationDays: PLAN_DAYS,
      isActive: false,
      notes: [
        `Created by Smart Diet Plan. Target ${n0(t.kcal)} kcal, protein ${t.p} g, carbs ${t.c} g, fat ${t.f} g.`,
        ...plan.explain,
        ...(plan.review.length ? ['Trainer review needed before activating:', ...plan.review] : []),
      ].join('\n'),
    };
    let createdId: string | null = null;
    try {
      let created;
      try {
        created = await createPlan.mutateAsync({ ...payload, name: baseName });
      } catch (err) {
        if (!toDietError(err).message.includes('already exists')) throw err;
        // Saved the same member's plan earlier today: keep both drafts, told apart by time.
        created = await createPlan.mutateAsync({ ...payload, name: `${baseName} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` });
      }
      createdId = created.id;
      await setMeals.mutateAsync({
        id: created.id,
        meals: plan.slots.flatMap((s) => s.items.map((it) => ({ foodId: it.foodId, mealType: s.type, quantity: it.qty }))),
      });
      toast.success('Draft plan saved. It stays inactive until you activate it.');
      router.push(`/diet-plans/${created.id}`);
    } catch (err) {
      // Do not leave an empty draft behind when the meals could not be saved.
      if (createdId) await dietService.deletePlan(createdId).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
      const message = toDietError(err).message;
      if (message.includes('do not exist')) {
        // A food was deleted after this page loaded: refresh the list so the plan is rebuilt from foods that still exist.
        void queryClient.invalidateQueries({ queryKey: ['foods'] });
        setError('A food in this plan was removed since the page loaded. The list is refreshed, so check the plan and save again.');
      } else {
        setError(message);
      }
    }
  };

  const busy = createPlan.isPending || setMeals.isPending;
  const tot = plan ? totals(plan) : null;
  const warn = plan ? warnings(plan) : [];
  const age = input ? ageOf(input.member.dob) : null;
  const m = input?.member;

  return (
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/diet-plans">
          <ArrowLeft className="size-4" /> Back to diet plans
        </Link>
      </Button>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:px-7"
        style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Programs</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Smart Diet Plan</h1>
          <p className="mt-1 max-w-2xl text-white/85">Pick a member and the planner builds a daily meal plan from their profile, goal and attendance. Review it, adjust anything, then save it as a draft.</p>
        </div>
      </motion.section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <PanelCard icon={User} accent="primary" title="Member">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="member-search">Find a member</Label>
                <Input id="member-search" placeholder="Search by name or member ID" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member-pick">Member</Label>
                <select
                  id="member-pick"
                  value={memberId ?? ''}
                  onChange={(e) => {
                    setMemberId(e.target.value || null);
                    setMix(0);
                    setEdit(null);
                    setError(null);
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <option value="">{members.isLoading ? 'Loading members…' : 'Select a member…'}</option>
                  {(members.data?.items ?? []).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({x.memberId})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {memberLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : null}
            {memberError ? <p role="alert" className="text-sm text-destructive">Could not load this member. Try again.</p> : null}
            {input && m ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                <Fact label="Age and sex" value={`${age ?? 'Not set'}${age !== null ? ' yrs' : ''}${m.sex ? `, ${SEX_LABEL[m.sex]}` : ''}`} />
                <Fact label="Height" value={m.heightCm ? `${m.heightCm} cm` : 'Not set'} />
                <Fact label="Weight" value={m.weightKg ? `${m.weightKg} kg` : 'Not set'} />
                <Fact label="Goal" value={m.goal ? GOALS[m.goal].label : 'Not set'} />
                <Fact label="Food preference" value={m.pref ? DIET_LABEL[m.pref] : 'Not set'} />
                <Fact label="Visits a week" value={`${Math.round(m.visits28 / 4)} (last 28 days)`} />
                <Fact label="Allergies" value={m.allergies || 'None recorded'} />
                <Fact label="Medical notes" value={m.medical || 'None recorded'} />
              </div>
            ) : null}
            {input?.weightSource ? <p className="text-xs text-muted-foreground">Weight source: {input.weightSource}.</p> : null}
          </PanelCard>

          {!memberId ? <Notice tone="primary" title="Pick a member to start">The plan is generated as soon as a member is selected.</Notice> : null}

          {result?.status === 'missing' && memberId ? (
            <Notice tone="warning" title="Complete the member profile first">
              <p>The planner needs these details before it can calculate calories:</p>
              <ul className="list-disc pl-5">
                {result.missing.map((k) => (
                  <li key={k}>{MISSING_LABEL[k]}</li>
                ))}
              </ul>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/members/${memberId}`}>Open member profile</Link>
              </Button>
            </Notice>
          ) : null}

          {result?.status === 'blocked' ? (
            <Notice tone="destructive" title="Automatic plan not available">
              <ul className="list-disc pl-5">
                {result.blocks.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <Button size="sm" variant="outline" asChild>
                <Link href="/diet-plans/new">Build a plan manually</Link>
              </Button>
            </Notice>
          ) : null}

          {result?.status === 'catalog' ? (
            <Notice tone="primary" title={catalogLoading ? 'Checking the food library…' : 'The food library needs more foods'}>
              <p>
                The planner uses {STARTER_FOODS.length} common Indian foods it already knows (proteins, carbs, vegetables, fruits, fats). Add them to the food library to generate plans. You can edit or remove any of them later.
              </p>
              <LoadingButton type="button" size="sm" loading={adding} loadingText="Adding…" onClick={addStarterFoods} disabled={!canCreate}>
                Add starter foods
              </LoadingButton>
            </Notice>
          ) : null}

          {plan && plan.review.length ? (
            <Notice tone="warning" title="Trainer review needed">
              <ul className="list-disc pl-5">
                {plan.review.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">The plan saves as an inactive draft. A trainer must check it before it is activated.</p>
            </Notice>
          ) : null}

          {warn.length ? (
            <Notice tone="warning" title="Check these numbers">
              <ul className="list-disc pl-5">
                {warn.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {plan ? (
            <SmartPlanMeals
              plan={plan}
              catalog={catalog}
              disabled={busy}
              onQty={(si, ii, qty) => mutate((c) => setQty(c, si, ii, qty))}
              onSwap={(si, ii, opt: SwapOption) => mutate((c) => applySwap(c, si, ii, opt))}
              onShuffle={() => setMix((x) => x + 1)}
            />
          ) : null}

          {error ? (
            <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {plan ? 'Saves as an inactive draft. Nothing reaches the member until you activate it.' : 'Pick a member to preview a plan.'}
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" asChild disabled={busy}>
                <Link href="/diet-plans">Cancel</Link>
              </Button>
              <LoadingButton type="button" loading={busy} loadingText="Saving…" disabled={!plan || !canCreate} onClick={save} className="border-0 px-6 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}>
                <Check className="size-4" /> Save draft plan
              </LoadingButton>
            </div>
          </div>
        </div>

        <aside aria-label="Daily target" className="flex flex-col gap-4 lg:sticky lg:top-3">
          {plan && tot ? (
            <PanelCard icon={Flame} accent="success" title="Daily target" delay={0.1}>
              <div className="mx-auto grid size-[132px] place-items-center rounded-full" style={{ backgroundImage: `conic-gradient(var(--primary) ${Math.min(100, (tot.kcal / plan.t.kcal) * 100)}%, var(--muted) 0)` }}>
                <div className="grid size-[100px] place-items-center rounded-full bg-card text-center leading-tight">
                  <span>
                    <b className="text-[22px] font-extrabold tabular-nums">{n0(tot.kcal)}</b>
                    <small className="block text-[11px] text-muted-foreground">of {n0(plan.t.kcal)} kcal</small>
                  </span>
                </div>
              </div>
              {(
                [
                  ['Protein', tot.p, plan.t.p, 'var(--chart-3)'],
                  ['Carbs', tot.c, plan.t.c, 'var(--chart-4)'],
                  ['Fat', tot.f, plan.t.f, 'var(--chart-5)'],
                ] as const
              ).map(([label, got, want, color]) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-sm tabular-nums">
                    <span>{label}</span>
                    <span className="text-muted-foreground">
                      {n0(got)} / {n0(want)} g
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, want ? (got / want) * 100 : 0)}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">How this was worked out</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                  {plan.explain.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ol>
              </details>
            </PanelCard>
          ) : (
            <PanelCard icon={Sparkles} accent="violet" title="How it works" delay={0.1}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Calories come from height, weight, age and gender, scaled by how often the member trains.</li>
                <li>The goal raises or lowers calories, then protein, fat and carbs are split by fixed rules.</li>
                <li>Foods are matched to the member&apos;s diet preference and allergies.</li>
                <li>Under 18, or a health concern, is blocked or flagged for trainer review.</li>
              </ul>
            </PanelCard>
          )}
        </aside>
      </div>
    </div>
  );
}
