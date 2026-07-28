import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MemberStatus, MembershipStatus } from '../types';

const MEMBER_STATUS_VARIANT: Record<MemberStatus, NonNullable<BadgeProps['variant']>> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  // No semantic "info" token in the design system — keep an explicit dark-mode-aware blue for this state only.
  FROZEN: 'outline',
};
const FROZEN_CLASSNAME = 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';

const MEMBERSHIP_STATUS_VARIANT: Record<MembershipStatus, NonNullable<BadgeProps['variant']>> = {
  ACTIVE: 'success',
  EXPIRED: 'destructive',
  CANCELLED: 'secondary',
  SUPERSEDED: 'warning',
};

export function MemberStatusBadge({ status, deleted }: { status: MemberStatus; deleted?: boolean }) {
  if (deleted) {
    return <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>;
  }
  return (
    <Badge
      variant={MEMBER_STATUS_VARIANT[status]}
      className={cn('font-medium', status === 'FROZEN' && FROZEN_CLASSNAME)}
    >
      {status}
    </Badge>
  );
}

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  return (
    <Badge variant={MEMBERSHIP_STATUS_VARIANT[status]} className="font-medium">
      {status}
    </Badge>
  );
}
