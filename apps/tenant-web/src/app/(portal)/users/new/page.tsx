'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, KeyRound, ListChecks, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { PasswordInput } from '@/features/auth/components/password-input';
import { PasswordStrengthMeter } from '@/features/auth/components/password-strength-meter';
import { getPasswordStrength } from '@/features/auth/utils/password-strength';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { BranchAccessCards } from '@/features/iam/components/branch-access-cards';
import type { BranchAssignment } from '@/features/iam/components/branch-access-editor';
import { RolePicker } from '@/features/iam/components/role-picker';
import { displayRoleName } from '@/features/iam/components/users-overview';
import { toIamError, useCreateUser, useRoles } from '@/features/iam/hooks/use-iam';
import { PanelCard } from '@/features/members/components/detail/detail-ui';

/** Direct account creation — for staff standing next to you; email lands already verified. */
export default function NewUserPage() {
  const router = useRouter();
  const createUser = useCreateUser();
  const roles = useRoles();
  const branches = useBranches();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [roleIds, setRoleIds] = React.useState<string[]>([]);
  const [branchAccess, setBranchAccess] = React.useState<{ allBranches: boolean; branches: BranchAssignment[] }>({
    allBranches: true,
    branches: [],
  });
  const [error, setError] = React.useState<string | null>(null);
  const [tried, setTried] = React.useState(false);

  // The "assign a role" message is stale the moment a role is picked.
  React.useEffect(() => {
    if (roleIds.length > 0) setError((current) => (current === 'Assign at least one role.' ? null : current));
  }, [roleIds]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTried(true);
    if (roleIds.length === 0) {
      setError('Assign at least one role.');
      return;
    }
    createUser.mutate(
      {
        name,
        email,
        phone: phone || undefined,
        password,
        roleIds,
        allBranches: branchAccess.allBranches,
        branches: branchAccess.allBranches ? undefined : branchAccess.branches,
      },
      {
        onSuccess: (user) => {
          toast.success(`${user.name} created`);
          router.push(`/users/${user.id}`);
        },
        onError: (err) => setError(toIamError(err).message),
      },
    );
  };

  const strong = getPasswordStrength(password).score === 5;
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const checks = [
    { label: 'Full name', ok: name.trim().length > 1 },
    { label: 'Valid email', ok: emailOk },
    { label: 'Strong password', ok: strong },
    { label: 'At least one role', ok: roleIds.length > 0 },
  ];
  const percent = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const pickedRoles = (roles.data ?? []).filter((r) => roleIds.includes(r.id));
  const branchSummary = branchAccess.allBranches ? 'All branches' : `${branchAccess.branches.length} branch${branchAccess.branches.length === 1 ? '' : 'es'}`;
  const busy = createUser.isPending;

  return (
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/users">
          <ArrowLeft className="size-4" /> Back to users
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
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Staff &amp; Access</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Create a user</h1>
          <p className="mt-1 text-white/85">Direct account creation for staff standing next to you. Their email is marked verified.</p>
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
                <Label htmlFor="name" required>Full name</Label>
                <Input id="name" placeholder="e.g. Priya Sharma" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} aria-invalid={(tried && name.trim().length < 2) || undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" required>Email</Label>
                <Input id="email" type="email" placeholder="priya@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} aria-invalid={(tried && !emailOk) || undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
              </div>
            </div>
          </PanelCard>

          <PanelCard icon={KeyRound} accent="violet" title="Temporary password" delay={0.05}>
            <div className="space-y-2">
              <Label htmlFor="password" required>Temporary password</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} aria-invalid={(tried && !strong) || undefined} />
              <PasswordStrengthMeter password={password} />
            </div>
          </PanelCard>

          <PanelCard icon={ShieldCheck} accent="aqua" title="Roles" delay={0.1} right={<span className="text-xs text-muted-foreground">Pick one or more</span>}>
            <RolePicker
              label="Roles"
              mode="multi"
              roles={roles.data}
              loading={roles.isPending}
              // SUPER_ADMIN is platform-plane and never offered; inactive roles are hidden.
              filter={(r) => r.name !== 'SUPER_ADMIN' && r.isActive}
              selected={roleIds}
              onChange={setRoleIds}
              disabled={busy}
              invalid={tried && roleIds.length === 0}
            />
            {tried && roleIds.length === 0 ? <p role="alert" className="text-xs text-destructive">Assign at least one role.</p> : null}
          </PanelCard>

          <PanelCard icon={MapPin} accent="warning" title="Branch access" delay={0.15}>
            <BranchAccessCards allBranches={branchAccess.allBranches} branches={branchAccess.branches} onChange={setBranchAccess} disabled={busy} />
          </PanelCard>

          <div className="sticky bottom-3 z-10 flex justify-between gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur">
            <Button type="button" variant="outline" asChild disabled={busy}>
              <Link href="/users">Cancel</Link>
            </Button>
            <LoadingButton type="submit" loading={busy} loadingText="Creating…" className="border-0 px-6 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}>
              <Check className="size-4" /> Create user
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
            <h3 className="min-h-[26px] truncate text-xl font-extrabold">{name || 'New user'}</h3>
            <p className="min-h-[19px] truncate text-[12.5px] text-white/85">{email || 'Start typing a name and email'}</p>
            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
              {pickedRoles.map((r) => (
                <span key={r.id} className="rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold">
                  {displayRoleName(r.name)}
                </span>
              ))}
              {branches.data ? <span className="rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold">{branchSummary}</span> : null}
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
            {['The account is created right away', 'Their email is marked verified', 'They sign in with this temporary password'].map((t, i) => (
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
