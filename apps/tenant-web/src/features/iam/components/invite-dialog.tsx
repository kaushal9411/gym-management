'use client';

import * as React from 'react';
import { MailPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toIamError, useCreateInvitation, useRoles } from '../hooks/use-iam';

const selectClassName = cn(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

/** "Invite user" — email + role; the invitee completes their own profile on acceptance. */
export function InviteDialog() {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const roles = useRoles();
  const createInvitation = useCreateInvitation();

  // OWNER and SUPER_ADMIN can't be granted by invite (backend enforces too).
  const invitable = (roles.data ?? []).filter((r) => r.isActive && r.name !== 'SUPER_ADMIN' && r.name !== 'OWNER');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !roleId) {
      setError('Email and role are both required.');
      return;
    }
    createInvitation.mutate(
      { email, roleId },
      {
        onSuccess: (invitation) => {
          toast.success(`Invitation sent to ${invitation.email}`);
          setOpen(false);
          setEmail('');
          setRoleId('');
        },
        onError: (err) => setError(toIamError(err).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MailPlus className="size-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a staff member</DialogTitle>
          <DialogDescription>They&apos;ll get an email link to set their password and complete their profile.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="trainer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={createInvitation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              className={selectClassName}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={createInvitation.isPending || roles.isPending}
            >
              <option value="">Select a role…</option>
              {invitable.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={createInvitation.isPending}>
            {createInvitation.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
