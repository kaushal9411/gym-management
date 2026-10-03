'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Briefcase, Check, ListChecks, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import {
  EmploymentInfoFields,
  type EmploymentInfoValue,
} from '@/features/staff/components/employment-info-fields';
import { StaffBranchesEditor } from '@/features/staff/components/staff-branches-editor';
import { STAFF_ROLE_OPTIONS } from '@/features/staff/components/staff-role-select';
import { toStaffError, useCreateStaff } from '@/features/staff/hooks/use-staff';
import type { StaffRole } from '@/features/staff/types';
import { useBranches } from '@/features/branch/hooks/use-branches';

const DEFAULT_EMPLOYMENT: EmploymentInfoValue = {
  employmentType: 'FULL_TIME',
  salaryType: 'MONTHLY',
  salaryAmount: '',
  shift: '',
  weeklyOff: '',
  workStatus: 'WORKING',
};

/** Creates the staff account and sends them an activation email to set their own password. Same fields/validation/mutation as before — restyled shell only. */
export default function NewStaffPage() {
  const router = useRouter();
  const createStaff = useCreateStaff();
  const branches = useBranches();

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [employeeId, setEmployeeId] = React.useState('');
  const [role, setRole] = React.useState<StaffRole>('TRAINER');
  const [branchAccess, setBranchAccess] = React.useState<{ branchIds: string[]; primaryBranchId: string | null }>({
    branchIds: [],
    primaryBranchId: null,
  });
  const [employment, setEmployment] = React.useState<EmploymentInfoValue>(DEFAULT_EMPLOYMENT);
  const [error, setError] = React.useState<string | null>(null);
  const [tried, setTried] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTried(true);
    if (!branchAccess.primaryBranchId) {
      setError('Assign at least one branch (and mark one as primary).');
      return;
    }
    createStaff.mutate(
      {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        employeeId: employeeId || undefined,
        role,
        primaryBranchId: branchAccess.primaryBranchId,
        branchIds: branchAccess.branchIds,
        employmentType: employment.employmentType,
        salaryType: employment.salaryType,
        salaryAmount: employment.salaryAmount ? Number(employment.salaryAmount) : undefined,
        shift: employment.shift || undefined,
        weeklyOff: employment.weeklyOff || undefined,
        workStatus: employment.workStatus,
      },
      {
        onSuccess: (staffMember) => {
          toast.success(`${staffMember.name} created — activation email sent`);
          router.push(`/staff/${staffMember.id}`);
        },
        onError: (err) => setError(toStaffError(err).message),
      },
    );
  };

  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const checks = [
    { label: 'Full name', ok: firstName.trim().length > 0 && lastName.trim().length > 0 },
    { label: 'Valid email', ok: emailOk },
    { label: 'Role selected', ok: !!role },
    { label: 'Primary branch confirmed', ok: !!branchAccess.primaryBranchId },
  ];
  const percent = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const name = `${firstName} ${lastName}`.trim();
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = STAFF_ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
  const primaryBranchName = branches.data?.find((b) => b.id === branchAccess.primaryBranchId)?.name;
  const busy = createStaff.isPending;

  return (
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/staff">
          <ArrowLeft className="size-4" /> Back to staff
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
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Team</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Add a staff member</h1>
          <p className="mt-1 text-white/85">Creates the account and sends an activation email so they can set their own password.</p>
        </div>
      </motion.section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} noValidate className="min-w-0 space-y-4">
          {error ? (
            <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </motion.p>
          ) : null}

          <PanelCard icon={UserRound} accent="primary" title="Account details" delay={0}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" required>First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={busy} aria-invalid={(tried && firstName.trim().length === 0) || undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" required>Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={busy} aria-invalid={(tried && lastName.trim().length === 0) || undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" required>Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} aria-invalid={(tried && !emailOk) || undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="employeeId">Employee ID (optional — auto-generated if left blank)</Label>
                <Input id="employeeId" className="max-w-xs" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={busy} />
              </div>
            </div>
          </PanelCard>

          <PanelCard icon={ShieldCheck} accent="violet" title="Role" delay={0.05} right={<span className="text-xs text-muted-foreground">Pick one</span>}>
            <div role="group" aria-label="Role" className="flex flex-wrap gap-2">
              {STAFF_ROLE_OPTIONS.map((opt) => {
                const on = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busy}
                    aria-pressed={on}
                    onClick={() => setRole(opt.value)}
                    title={opt.description}
                    className="rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-all hover:-translate-y-px disabled:opacity-50"
                    style={on ? { backgroundColor: 'var(--chart-7)', color: '#fff', borderColor: 'var(--chart-7)', boxShadow: '0 10px 20px -12px var(--chart-7)' } : undefined}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </PanelCard>

          <PanelCard icon={MapPin} accent="warning" title="Branch access" delay={0.1} right={<span className="text-xs text-muted-foreground">Assign at least one, mark one primary</span>}>
            <StaffBranchesEditor
              branchIds={branchAccess.branchIds}
              primaryBranchId={branchAccess.primaryBranchId}
              onChange={setBranchAccess}
              disabled={busy}
            />
            {tried && !branchAccess.primaryBranchId ? <p role="alert" className="mt-2 text-xs text-destructive">Assign at least one branch (and mark one as primary).</p> : null}
          </PanelCard>

          <PanelCard icon={Briefcase} accent="aqua" title="Employment information" delay={0.15}>
            <EmploymentInfoFields value={employment} onChange={setEmployment} disabled={busy} />
          </PanelCard>

          <div className="sticky bottom-3 z-10 flex justify-between gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur">
            <Button type="button" variant="outline" asChild disabled={busy}>
              <Link href="/staff">Cancel</Link>
            </Button>
            <LoadingButton type="submit" loading={busy} loadingText="Creating…" className="border-0 px-6 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}>
              <Check className="size-4" /> Create staff member
            </LoadingButton>
          </div>
        </form>

        <aside aria-label="Live summary" className="flex flex-col gap-4 lg:sticky lg:top-3">
          <div
            className="relative overflow-hidden rounded-3xl p-5 text-center text-white shadow-lg"
            style={{ backgroundImage: 'radial-gradient(400px 200px at 80% -20%, color-mix(in oklch, #c026d3 70%, transparent), transparent 60%), linear-gradient(135deg, #4338ca, #7c3aed)' }}
          >
            <div className="mx-auto mb-2.5 size-20 rounded-full p-1" style={{ backgroundImage: 'conic-gradient(from 210deg, #fde68a, #f9a8d4, #a5b4fc, #6ee7b7, #fde68a)' }}>
              <motion.span key={initials} initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="grid size-full place-items-center rounded-full bg-indigo-950/85 text-2xl font-extrabold">
                {initials || '?'}
              </motion.span>
            </div>
            <h3 className="min-h-[26px] truncate text-xl font-extrabold">{name || 'New staff member'}</h3>
            <p className="min-h-[19px] truncate text-[12.5px] text-white/85">{email || 'Start typing a name and email'}</p>
            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
              <span className="rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold">{roleLabel}</span>
              {primaryBranchName ? <span className="rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold">{primaryBranchName}</span> : null}
            </div>
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

          <ol className="grid gap-2 rounded-2xl border border-[color-mix(in_oklch,var(--chart-3)_25%,transparent)] bg-[color-mix(in_oklch,var(--chart-3)_8%,transparent)] p-3.5 text-[12.5px]">
            {['The account is created right away', 'An activation email is sent to them', 'They set their own password to sign in'].map((t, i) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[color-mix(in_oklch,var(--chart-3)_18%,transparent)] text-[11px] font-extrabold" style={{ color: 'var(--chart-3)' }}>{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
