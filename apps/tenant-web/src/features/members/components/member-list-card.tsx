'use client';

import Link from 'next/link';
import { MessageCircle, MoreHorizontal, Phone, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toAttendanceError, useManualCheckIn } from '@/features/attendance/hooks/use-attendance';
import { useCurrencySymbol } from '@/lib/currency';
import { toMemberError, useRenewMembership } from '../hooks/use-members';
import type { MemberListItem } from '../types';
import { MemberStatusBadge } from './member-status-badge';

/** `9876543210` → `919876543210` for a `wa.me` link — prepends India's country code only when the stored number looks like a bare 10-digit local number (every test/seed number in this app is), leaves anything else (already has a code, or a weird length) untouched rather than guessing. */
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export type MemberCardAction = 'activate' | 'deactivate' | 'restore' | 'delete';

interface MemberListCardProps {
  member: MemberListItem;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  canManage: boolean;
  canDelete: boolean;
  canRestore: boolean;
  canAssignMembership: boolean;
  canRenew: boolean;
  canCheckIn: boolean;
  onRequestAction: (action: MemberCardAction) => void;
}

export function MemberListCard({
  member: m,
  selected,
  onToggleSelect,
  canManage,
  canDelete,
  canRestore,
  canAssignMembership,
  canRenew,
  canCheckIn,
  onRequestAction,
}: MemberListCardProps) {
  const currencySymbol = useCurrencySymbol();
  const renewMembership = useRenewMembership();
  const manualCheckIn = useManualCheckIn();
  const outstanding = Number(m.outstandingAmount);

  const handleRenew = () => {
    renewMembership.mutate(
      { id: m.id, payload: {} },
      {
        onSuccess: () => toast.success('Membership renewed.'),
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const handlePunchIn = () => {
    manualCheckIn.mutate(
      { memberId: m.id, branchId: m.branch.id },
      {
        onSuccess: () => toast.success(`${m.name} checked in.`),
        onError: (err) => toast.error(toAttendanceError(err).message),
      },
    );
  };

  return (
    <div className={`rounded-xl border p-4 transition-colors ${m.deletedAt ? 'bg-destructive/5' : 'bg-card'}`}>
      <div className="flex items-start gap-3">
        {canManage || canDelete || canRestore ? (
          <Checkbox className="mt-1.5" checked={selected} onCheckedChange={(c) => onToggleSelect(c === true)} aria-label={`Select ${m.name}`} />
        ) : null}
        <Link href={`/members/${m.id}`} className="shrink-0">
          <Avatar className="size-12">
            {m.profilePhotoUrl ? <AvatarImage src={m.profilePhotoUrl} alt="" /> : null}
            <AvatarFallback>{m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/members/${m.id}`} className="min-w-0 hover:underline">
              <span className="block truncate font-semibold">{m.name}</span>
              <span className="block text-xs text-muted-foreground">{m.memberId}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              <MemberStatusBadge status={m.status} deleted={!!m.deletedAt} />
              {canManage || canDelete || canRestore || canAssignMembership ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`More actions for ${m.name}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/members/${m.id}`}>View / edit</Link>
                    </DropdownMenuItem>
                    {canAssignMembership && !m.deletedAt && !m.currentMembership ? (
                      <DropdownMenuItem asChild>
                        <Link href={`/members/${m.id}#membership`}>Assign membership</Link>
                      </DropdownMenuItem>
                    ) : null}
                    {m.deletedAt ? (
                      canRestore ? <DropdownMenuItem onClick={() => onRequestAction('restore')}>Restore</DropdownMenuItem> : null
                    ) : canManage ? (
                      m.status === 'ACTIVE' ? (
                        <DropdownMenuItem onClick={() => onRequestAction('deactivate')}>Deactivate</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onRequestAction('activate')}>Activate</DropdownMenuItem>
                      )
                    ) : null}
                    {!m.deletedAt && canDelete ? (
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onRequestAction('delete')}>
                        Delete
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Mobile</p>
              <p className="font-medium">{m.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due amount</p>
              <p className={outstanding > 0 ? 'font-medium text-destructive' : 'font-medium text-emerald-600'}>
                {currencySymbol}{outstanding.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="truncate font-medium">{m.currentMembership?.planName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan expiry</p>
              <div className="font-medium">
                {m.currentMembership ? (
                  <>
                    {new Date(m.currentMembership.endDate).toLocaleDateString()}
                    {m.currentMembership.status !== 'ACTIVE' ? (
                      <Badge variant="outline" className="ml-1.5 align-middle text-[10px]">{m.currentMembership.status}</Badge>
                    ) : null}
                  </>
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <Button variant="outline" size="sm" disabled={!m.phone} asChild>
              <a href={m.phone ? `tel:${m.phone}` : undefined} aria-disabled={!m.phone}>
                <Phone className="size-3.5" /> Call
              </a>
            </Button>
            <Button variant="outline" size="sm" disabled={!m.phone} asChild>
              <a
                href={m.phone ? `https://wa.me/${toWhatsAppNumber(m.phone)}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!m.phone}
              >
                <MessageCircle className="size-3.5" /> WhatsApp
              </a>
            </Button>
            {canRenew && !m.deletedAt && m.currentMembership ? (
              <Button variant="outline" size="sm" disabled={renewMembership.isPending} onClick={handleRenew}>
                {renewMembership.isPending ? 'Renewing…' : 'Renew'}
              </Button>
            ) : null}
            {canCheckIn && !m.deletedAt ? (
              <Button size="sm" disabled={manualCheckIn.isPending} onClick={handlePunchIn}>
                <UserCheck className="size-3.5" /> {manualCheckIn.isPending ? 'Checking in…' : 'Punch In'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
