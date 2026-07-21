import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MemberStatus, MembershipStatus } from '../types';

const MEMBER_STATUS_STYLES: Record<MemberStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  INACTIVE: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  FROZEN: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
};

const MEMBERSHIP_STATUS_STYLES: Record<MembershipStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  CANCELLED: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  SUPERSEDED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

export function MemberStatusBadge({ status, deleted }: { status: MemberStatus; deleted?: boolean }) {
  if (deleted) {
    return <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>;
  }
  return <Badge className={cn('border-transparent font-medium', MEMBER_STATUS_STYLES[status])}>{status}</Badge>;
}

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  return <Badge className={cn('border-transparent font-medium', MEMBERSHIP_STATUS_STYLES[status])}>{status}</Badge>;
}
