import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InvitationStatus, UserStatus } from '../types';

const USER_STATUS_VARIANT: Record<UserStatus, NonNullable<BadgeProps['variant']>> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'warning',
  // No semantic "info" token in the design system — keep an explicit dark-mode-aware orange for this state only,
  // so it stays distinguishable from the amber "pending" state.
  LOCKED: 'outline',
  SUSPENDED: 'destructive',
  DEACTIVATED: 'secondary',
};
const LOCKED_CLASSNAME = 'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';

const INVITE_STATUS_VARIANT: Record<InvitationStatus, NonNullable<BadgeProps['variant']>> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REVOKED: 'destructive',
  EXPIRED: 'secondary',
};

export function UserStatusBadge({ status, deleted }: { status: UserStatus; deleted?: boolean }) {
  if (deleted) {
    return <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>;
  }
  return (
    <Badge
      variant={USER_STATUS_VARIANT[status]}
      className={cn('font-medium', status === 'LOCKED' && LOCKED_CLASSNAME)}
    >
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return (
    <Badge variant={INVITE_STATUS_VARIANT[status]} className="font-medium">
      {status}
    </Badge>
  );
}
