import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InvitationStatus, UserStatus } from '../types';

const USER_STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  PENDING_VERIFICATION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  LOCKED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  DEACTIVATED: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const INVITE_STATUS_STYLES: Record<InvitationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  ACCEPTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  REVOKED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  EXPIRED: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export function UserStatusBadge({ status, deleted }: { status: UserStatus; deleted?: boolean }) {
  if (deleted) {
    return <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>;
  }
  return <Badge className={cn('border-transparent font-medium', USER_STATUS_STYLES[status])}>{status.replace('_', ' ')}</Badge>;
}

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return <Badge className={cn('border-transparent font-medium', INVITE_STATUS_STYLES[status])}>{status}</Badge>;
}
