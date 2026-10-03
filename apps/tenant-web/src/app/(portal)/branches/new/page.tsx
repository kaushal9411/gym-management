'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, Check, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import { BranchFormFields, DEFAULT_BRANCH_FORM_STATE, type BranchFormState } from '@/features/branch/components/branch-form-fields';
import { toBranchError, useCreateBranch } from '@/features/branch/hooks/use-branches';

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

/** Same hero + PanelCard-sections + live-preview-sidebar shell as Add Staff — every field/handler below is exactly as before, only the wrapping layout changed. */
export default function NewBranchPage() {
  const router = useRouter();
  const createBranch = useCreateBranch();
  const [form, setForm] = React.useState<BranchFormState>(DEFAULT_BRANCH_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);
  const [tried, setTried] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTried(true);
    if (!form.name.trim()) {
      setError('Branch name is required.');
      return;
    }
    createBranch.mutate(
      {
        name: form.name,
        branchCode: form.branchCode || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        whatsappNumber: form.whatsappNumber || undefined,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        postalCode: form.postalCode || undefined,
        latitude: toNumberOrUndefined(form.latitude),
        longitude: toNumberOrUndefined(form.longitude),
        timezone: form.timezone || undefined,
        operatingHours: Object.keys(form.operatingHours).length > 0 ? form.operatingHours : undefined,
        holidays: form.holidays.length > 0 ? form.holidays : undefined,
        capacity: toNumberOrUndefined(form.capacity),
        maxMembers: toNumberOrUndefined(form.maxMembers),
        maxStaff: toNumberOrUndefined(form.maxStaff),
        allowCheckIn: form.allowCheckIn,
        notes: form.notes || undefined,
      },
      {
        onSuccess: (branch) => {
          toast.success(`${branch.name} created`);
          router.push(`/branches/${branch.id}`);
        },
        onError: (err) => setError(toBranchError(err).message),
      },
    );
  };

  const checks = [
    { label: 'Branch name', ok: form.name.trim().length > 0 },
    { label: 'City', ok: form.city.trim().length > 0 },
    { label: 'Phone or email', ok: form.phone.trim().length > 0 || form.email.trim().length > 0 },
  ];
  const percent = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const busy = createBranch.isPending;

  return (
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/branches">
          <ArrowLeft className="size-4" /> Back to branches
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
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Locations</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Create a branch</h1>
          <p className="mt-1 text-white/85">Add a new location your gym operates from.</p>
        </div>
      </motion.section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} noValidate className="min-w-0 space-y-4">
          {error ? (
            <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </motion.p>
          ) : null}

          <BranchFormFields value={form} onChange={setForm} disabled={busy} />

          <div className="sticky bottom-3 z-10 flex justify-between gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur">
            <Button type="button" variant="outline" asChild disabled={busy}>
              <Link href="/branches">Cancel</Link>
            </Button>
            <LoadingButton type="submit" loading={busy} loadingText="Creating…" className="border-0 px-6 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}>
              <Check className="size-4" /> Create branch
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
                <Building2 className="size-8" aria-hidden />
              </span>
            </div>
            <h3 className="min-h-[26px] truncate text-xl font-extrabold">{form.name || 'New branch'}</h3>
            <p className="min-h-[19px] truncate text-[12.5px] text-white/85">{form.city || 'Start typing a name and city'}</p>
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
