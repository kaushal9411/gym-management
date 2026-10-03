'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Mail, MailPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toIamError, useCreateInvitation, useRoles } from '../hooks/use-iam';
import { RolePicker } from './role-picker';

/** "Invite user" — email + role; the invitee completes their own profile on acceptance. */
export function InviteDialog() {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [tried, setTried] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const roles = useRoles();
  const createInvitation = useCreateInvitation();

  const reset = () => {
    setEmail('');
    setRoleId('');
    setError(null);
    setTried(false);
    setSentTo(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTried(true);
    if (!email || !roleId) {
      setError('Email and role are both required.');
      return;
    }
    createInvitation.mutate(
      { email, roleId },
      {
        onSuccess: (invitation) => {
          toast.success(`Invitation sent to ${invitation.email}`);
          setSentTo(invitation.email);
        },
        onError: (err) => setError(toIamError(err).message),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MailPlus className="size-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[560px] gap-0 overflow-y-auto rounded-3xl p-0 [&>button.absolute]:right-3.5 [&>button.absolute]:top-3.5 [&>button.absolute]:rounded-lg [&>button.absolute]:bg-white/20 [&>button.absolute]:p-1.5 [&>button.absolute]:text-white [&>button.absolute]:opacity-100 [&>button.absolute]:hover:bg-white/30">
        {sentTo ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid justify-items-center gap-2.5 px-6 py-11 text-center">
            <DialogTitle className="sr-only">Invitation sent</DialogTitle>
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="grid size-[78px] place-items-center rounded-full text-white shadow-[0_0_0_10px_color-mix(in_oklch,var(--success)_18%,transparent)]"
              style={{ backgroundImage: 'linear-gradient(135deg, var(--success), var(--chart-3))' }}
            >
              <Check className="size-9" strokeWidth={3} />
            </motion.div>
            <h3 className="text-xl font-extrabold">Invitation sent</h3>
            <DialogDescription className="max-w-xs">{sentTo} will get an email link to set a password.</DialogDescription>
            <Button className="mt-2 border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }} onClick={() => setOpen(false)}>
              Done
            </Button>
          </motion.div>
        ) : (
          <>
            <div
              className="relative overflow-hidden px-6 pb-5 pt-6 text-white"
              style={{ backgroundImage: 'radial-gradient(500px 220px at 90% -40%, color-mix(in oklch, #c026d3 80%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
              <div className="relative">
                <motion.div
                  animate={{ y: [0, -4, 0], rotate: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="mb-3 grid size-[54px] place-items-center rounded-2xl border border-white/35 bg-white/20"
                >
                  <Mail className="size-6" aria-hidden />
                </motion.div>
                <DialogTitle className="text-[23px] font-extrabold leading-tight tracking-tight">Invite a staff member</DialogTitle>
                <DialogDescription className="mt-1 text-[13.5px] text-white/90">They&apos;ll get an email link to set their password and complete their profile.</DialogDescription>
              </div>
            </div>

            <form onSubmit={submit} noValidate className="grid gap-[18px] px-6 pb-6 pt-5">
              {error ? (
                <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
                  {error}
                </motion.p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="invite-email" required>Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    id="invite-email"
                    type="email"
                    placeholder="trainer@example.com"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={createInvitation.isPending}
                    aria-invalid={(tried && !email) || undefined}
                    className="h-[46px] w-full rounded-2xl border border-input bg-muted/30 pl-10 pr-3.5 text-sm transition-all placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-destructive/15 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label required>Role</Label>
                <RolePicker
                  label="Role"
                  mode="single"
                  roles={roles.data}
                  loading={roles.isPending}
                  // OWNER and SUPER_ADMIN can't be granted by invite (backend enforces too).
                  filter={(r) => r.isActive && r.name !== 'SUPER_ADMIN' && r.name !== 'OWNER'}
                  selected={roleId ? [roleId] : []}
                  onChange={(ids) => setRoleId(ids[0] ?? '')}
                  disabled={createInvitation.isPending}
                  invalid={tried && !roleId}
                />
              </div>

              <ol className="grid gap-2 rounded-2xl border border-[color-mix(in_oklch,var(--chart-3)_25%,transparent)] bg-[color-mix(in_oklch,var(--chart-3)_8%,transparent)] p-3.5 text-[12.5px]">
                {['We email them a secure link', 'They set a password and finish their profile', 'They appear under Users. The link works for 48 hours.'].map((t, i) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[color-mix(in_oklch,var(--chart-3)_18%,transparent)] text-[11px] font-extrabold" style={{ color: 'var(--chart-3)' }}>{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createInvitation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createInvitation.isPending} className="border-0 px-6 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}>
                  <MailPlus className="size-4" /> {createInvitation.isPending ? 'Sending…' : 'Send invitation'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
