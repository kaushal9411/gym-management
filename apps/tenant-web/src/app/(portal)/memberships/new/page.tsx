'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, IdCard, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import { DEFAULT_PLAN_FORM_STATE, PlanFormFields, type PlanFormState } from '@/features/members/components/plan-form-fields';
import { toMemberError, useCreateMembershipPlan } from '@/features/members/hooks/use-members';
import { useCurrencySymbol } from '@/lib/currency';

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

/** Same hero + PanelCard-sections + live-preview-sidebar shell as Create Branch — every field/handler below is exactly as before, only the wrapping layout changed. */
export default function NewMembershipPlanPage() {
  const router = useRouter();
  const createPlan = useCreateMembershipPlan();
  const currencySymbol = useCurrencySymbol();
  const [form, setForm] = React.useState<PlanFormState>(DEFAULT_PLAN_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);
  const [tried, setTried] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTried(true);
    if (!form.name.trim() || !form.durationValue || !form.price) {
      setError('Name, duration, and price are required.');
      return;
    }
    createPlan.mutate(
      {
        name: form.name,
        planCode: form.planCode || undefined,
        description: form.description || undefined,
        category: form.category || undefined,
        durationValue: Number(form.durationValue),
        durationType: form.durationType,
        price: Number(form.price),
        joiningFee: toNumberOrUndefined(form.joiningFee),
        taxPercentage: toNumberOrUndefined(form.taxPercentage),
        discountPercentage: toNumberOrUndefined(form.discountPercentage),
        displayOrder: toNumberOrUndefined(form.displayOrder),
        notes: form.notes || undefined,
        gymAccessAllBranches: form.gymAccessAllBranches,
        ptSessionsIncluded: toNumberOrUndefined(form.ptSessionsIncluded),
        groupClassesIncluded: toNumberOrUndefined(form.groupClassesIncluded),
        dietConsultationIncluded: form.dietConsultationIncluded,
        lockerAccess: form.lockerAccess,
        guestPasses: toNumberOrUndefined(form.guestPasses),
        freezeAllowed: form.freezeAllowed,
        freezeDaysLimit: toNumberOrUndefined(form.freezeDaysLimit) ?? null,
      },
      {
        onSuccess: (plan) => {
          toast.success(`${plan.name} created`);
          router.push(`/memberships/${plan.id}`);
        },
        onError: (err) => setError(toMemberError(err).message),
      },
    );
  };

  const checks = [
    { label: 'Plan name', ok: form.name.trim().length > 0 },
    { label: 'Duration', ok: form.durationValue.trim().length > 0 },
    { label: 'Price', ok: form.price.trim().length > 0 },
  ];
  const percent = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const busy = createPlan.isPending;
  const priceNumber = Number(form.price);
  const previewPrice = Number.isFinite(priceNumber) && form.price.trim() !== '' ? priceNumber : null;

  return (
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/memberships">
          <ArrowLeft className="size-4" /> Back to membership plans
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
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Catalog</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Create a membership plan</h1>
          <p className="mt-1 text-white/85">Add a new plan members can be assigned to.</p>
        </div>
      </motion.section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} noValidate className="min-w-0 space-y-4">
          {error ? (
            <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </motion.p>
          ) : null}

          <PlanFormFields value={form} onChange={setForm} disabled={busy} />

          <div className="sticky bottom-3 z-10 flex justify-between gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur">
            <Button type="button" variant="outline" asChild disabled={busy}>
              <Link href="/memberships">Cancel</Link>
            </Button>
            <LoadingButton type="submit" loading={busy} loadingText="Creating…" className="border-0 px-6 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}>
              <Check className="size-4" /> Create plan
            </LoadingButton>
          </div>
        </form>

        <aside aria-label="Live summary" className="flex flex-col gap-4 lg:sticky lg:top-3">
          <div
            className="relative overflow-hidden rounded-3xl p-5 text-center text-white shadow-lg"
            style={{ backgroundImage: 'radial-gradient(400px 200px at 80% -20%, color-mix(in oklch, #c026d3 70%, transparent), transparent 60%), linear-gradient(135deg, #4338ca, #7c3aed)' }}
          >
            <div className="mx-auto mb-2.5 grid size-20 place-items-center rounded-full p-1" style={{ backgroundImage: 'conic-gradient(from 210deg, #fde68a, #f9a8d4, #a5b4fc, #6ee7b7, #fde68a)' }}>
              <span className="grid size-full place-items-center rounded-full bg-indigo-950/85">
                <IdCard className="size-8" aria-hidden />
              </span>
            </div>
            <h3 className="min-h-[26px] truncate text-xl font-extrabold">{form.name || 'New plan'}</h3>
            <p className="min-h-[19px] truncate text-[12.5px] text-white/85">
              {previewPrice !== null ? `${currencySymbol}${previewPrice.toFixed(2)} / ${form.durationValue || '—'} ${form.durationType.toLowerCase()}` : 'Start typing a name and price'}
            </p>
          </div>

          <PanelCard icon={ListChecks} accent="success" title="Ready to create" delay={0.1}>
            <div className="flex items-center gap-4">
              <div className="grid size-[74px] shrink-0 place-items-center rounded-full transition-all duration-500" style={{ backgroundImage: `conic-gradient(var(--success) ${percent}%, color-mix(in oklch, var(--success) 16%, transparent) 0)` }}>
                <div className="grid size-[54px] place-items-center rounded-full bg-card text-[15px] font-extrabold tabular-nums">{percent}%</div>
              </div>
              <ul className="grid gap-1 text-[12.5px]">
                {checks.map((c) => (
                  <li key={c.label} className={`flex items-center gap-2 ${c.ok ? 'font-semibold' : 'text-muted-foreground'}`} style={c.ok ? { color: 'var(--success)' } : undefined}>
                    <span className="grid size-3.5 place-items-center rounded-full border-2" style={c.ok ? { backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' } : undefined}>
                      {c.ok ? <Check className="size-2.5" strokeWidth={4} /> : null}
                    </span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </PanelCard>

          {tried && error ? (
            <p role="alert" className="text-xs text-destructive">{error}</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
