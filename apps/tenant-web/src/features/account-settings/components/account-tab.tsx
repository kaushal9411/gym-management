'use client';

import { Building2, CheckCircle2, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { avatarColor, initials } from '@/features/finance/components/payments/payments-ui';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { useIamProfile } from '@/features/iam/hooks/use-iam';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AccentPanel, Field, fmtWhen } from './settings-ui';

export function AccountTab() {
  const user = useCurrentUser();
  const tenant = useTenant();
  const profile = useIamProfile();
  const name = user?.name ?? '';
  const p = profile.data;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AccentPanel title="Your profile" subtitle="Edit your name, email and photo from the Profile page." icon={UserRound} accent="members" action={<Link href="/profile" className="text-sm font-bold text-primary hover:underline">Edit profile</Link>}>
        <div className="mb-4 flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-extrabold text-white" style={{ backgroundColor: avatarColor(name || user?.email || 'user') }}>
            {initials(name) || '?'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            {p?.emailVerifiedAt ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                <CheckCircle2 className="size-3" aria-hidden /> Email verified
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Field label="Role">{user?.role}</Field>
          {profile.isPending ? <Skeleton className="h-14 rounded-xl" /> : p?.phone ? <Field label="Phone">{p.phone}</Field> : null}
          {p?.lastLoginAt ? <Field label="Last sign-in">{fmtWhen(p.lastLoginAt)}</Field> : null}
          {p?.createdAt ? <Field label="Member since">{new Date(p.createdAt).toLocaleDateString()}</Field> : null}
        </div>
      </AccentPanel>

      <AccentPanel title="Your gym" subtitle="Workspace this account belongs to." icon={Building2} accent="finance">
        <p className="mb-4 text-lg font-extrabold">{tenant.name}</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Field label="Plan">{tenant.subscription?.planName ?? '—'}</Field>
          <Field label="Status">{tenant.status.replace('_', ' ')}</Field>
          <Field label="Timezone">{tenant.timezone}</Field>
          <Field label="Currency">{tenant.currency}</Field>
        </div>
      </AccentPanel>
    </div>
  );
}
