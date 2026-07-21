'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { IamNav } from '@/features/iam/components/iam-nav';
import { InviteDialog } from '@/features/iam/components/invite-dialog';
import { InvitationStatusBadge } from '@/features/iam/components/status-badge';
import { toIamError, useInvitationAction, useInvitations } from '@/features/iam/hooks/use-iam';
import type { InvitationDto, InvitationStatus } from '@/features/iam/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

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

  const columns: DataTableColumn<InvitationDto>[] = [
    { key: 'email', header: 'Email', render: (i) => <span className="font-medium">{i.email}</span> },
    { key: 'role', header: 'Role', render: (i) => i.role.name },
    { key: 'invitedBy', header: 'Invited by', render: (i) => i.invitedBy },
    { key: 'status', header: 'Status', render: (i) => <InvitationStatusBadge status={i.status} /> },
    {
      key: 'expires',
      header: 'Expires',
      render: (i) => (i.status === 'PENDING' ? new Date(i.expiresAt).toLocaleString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      render: (i) =>
        i.status === 'PENDING' ? (
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={invitationAction.isPending} onClick={() => run(i, 'resend')}>
              Resend
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={invitationAction.isPending}
              onClick={() => run(i, 'revoke')}
            >
              Revoke
            </Button>
          </span>
        ) : null,
    },
  ];

  const data = invitations.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invitations</h1>
          <p className="text-muted-foreground">Pending invites expire after 48 hours.</p>
        </div>
        <InviteDialog />
      </div>

      <IamNav />

      <select
        className={selectClassName}
        value={status}
        onChange={(e) => {
          setStatus(e.target.value as InvitationStatus | '');
          setPage(1);
        }}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        {(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] as const).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(i) => i.id}
        loading={invitations.isPending}
        emptyMessage="No invitations yet — invite your first staff member."
      />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
