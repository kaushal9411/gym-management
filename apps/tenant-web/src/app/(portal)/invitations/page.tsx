'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { IamHero } from '@/features/iam/components/iam-hero';
import { InviteDialog } from '@/features/iam/components/invite-dialog';
import { displayRoleName } from '@/features/iam/components/users-overview';
import { toIamError, useInvitationAction, useInvitations } from '@/features/iam/hooks/use-iam';
import type { InvitationDto, InvitationStatus } from '@/features/iam/types';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';

const STATUS_TONE: Record<InvitationStatus, Accent> = { PENDING: 'warning', ACCEPTED: 'success', REVOKED: 'destructive', EXPIRED: 'violet' };
const CHIPS: Array<{ value: InvitationStatus | ''; label: string; accent: Accent }> = [
  { value: '', label: 'All', accent: 'primary' },
  { value: 'PENDING', label: 'Pending', accent: STATUS_TONE.PENDING },
  { value: 'ACCEPTED', label: 'Accepted', accent: STATUS_TONE.ACCEPTED },
  { value: 'REVOKED', label: 'Revoked', accent: STATUS_TONE.REVOKED },
  { value: 'EXPIRED', label: 'Expired', accent: STATUS_TONE.EXPIRED },
];
const INVITE_WINDOW_HOURS = 48;

/** Ring that drains as a pending invite approaches its 48-hour expiry. */
function Countdown({ invitation, accent }: { invitation: InvitationDto; accent: Accent }) {
  const pending = invitation.status === 'PENDING';
  const hoursLeft = Math.max(0, Math.ceil((new Date(invitation.expiresAt).getTime() - Date.now()) / 3_600_000));
  const percent = pending ? Math.min(100, (hoursLeft / INVITE_WINDOW_HOURS) * 100) : 100;
  return (
    <div className="grid size-[58px] shrink-0 place-items-center rounded-full" style={{ backgroundImage: `conic-gradient(${accentVar(accent)} ${percent}%, ${tint(accent, 16)} 0)` }}>
      <div className="grid size-[42px] place-items-center rounded-full bg-card text-center text-xs font-extrabold leading-none tabular-nums">
        {pending ? `${hoursLeft}h` : invitation.status === 'ACCEPTED' ? '✓' : '–'}
      </div>
    </div>
  );
}

export default function InvitationsPage() {
  const [status, setStatus] = React.useState<InvitationStatus | ''>('');
  const [page, setPage] = React.useState(1);
  const invitations = useInvitations({ status: status || undefined, page, limit: 20 });
  const invitationAction = useInvitationAction();

  const run = (invitation: InvitationDto, action: 'resend' | 'revoke') =>
    invitationAction.mutate(
      { invitationId: invitation.id, action },
      {
        onSuccess: () => toast.success(action === 'resend' ? `Re-sent to ${invitation.email}` : 'Invitation revoked'),
        onError: (err) => toast.error(toIamError(err).message),
      },
    );

  const data = invitations.data;
  const items = data?.items ?? [];

  return (
    <div className="w-full space-y-5">
      <IamHero title="Invitations" subtitle="Pending invites expire after 48 hours." actions={<InviteDialog />} />

      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border bg-card/90 p-2.5 shadow-sm backdrop-blur" role="group" aria-label="Filter by status">
        {CHIPS.map((c) => {
          const on = status === c.value;
          return (
            <button
              key={c.label}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setStatus(c.value);
                setPage(1);
              }}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-all hover:-translate-y-px"
              style={on ? { backgroundColor: accentVar(c.accent), color: '#fff', borderColor: accentVar(c.accent), boxShadow: `0 8px 18px -10px ${accentVar(c.accent)}` } : undefined}
            >
              {c.label}
            </button>
          );
        })}
        {data ? <span className="ml-auto text-xs tabular-nums text-muted-foreground">{data.total} {data.total === 1 ? 'invitation' : 'invitations'}</span> : null}
      </div>

      {invitations.error ? (
        <EmptyState
          icon={Mail}
          title="Couldn't load invitations"
          description={invitations.error instanceof Error ? invitations.error.message : 'Something went wrong loading this data.'}
          action={
            <Button variant="outline" size="sm" onClick={() => invitations.refetch()}>
              Retry
            </Button>
          }
        />
      ) : invitations.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Mail} title="No invitations yet. Invite your first staff member." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((inv, i) => {
            const tone = STATUS_TONE[inv.status];
            return (
              <motion.article
                key={inv.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.5) }}
                className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-lg"
              >
                <Countdown invitation={inv} accent={tone} />
                <div className="min-w-0">
                  <b className="block break-all text-sm font-bold">{inv.email}</b>
                  <p className="text-xs text-muted-foreground">
                    {displayRoleName(inv.role.name)} · invited by {inv.invitedBy}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint(tone, 14), color: accentVar(tone) }}>
                      {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                    </span>
                    {inv.status === 'PENDING' ? (
                      <>
                        <Button variant="outline" size="sm" disabled={invitationAction.isPending} onClick={() => run(inv, 'resend')}>
                          Resend
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" disabled={invitationAction.isPending} onClick={() => run(inv, 'revoke')}>
                          Revoke
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {data ? <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} /> : null}
    </div>
  );
}
