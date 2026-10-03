'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, MapPin, MessageCircle, MoreHorizontal, Phone, RefreshCw, UserCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toAttendanceError, useManualCheckIn } from '@/features/attendance/hooks/use-attendance';
import { useCurrencySymbol } from '@/lib/currency';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { toMemberError, useRenewMembership } from '../../hooks/use-members';
import type { MemberListItem } from '../../types';
import { type Accent, ProgressBar, accentVar, formatMoney, tint } from '../detail/detail-ui';

/** `9876543210` → `919876543210` for a `wa.me` link — prepends India's country code only when the stored number looks like a bare 10-digit local number, leaves anything else untouched rather than guessing. */
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export type MemberCardAction = 'activate' | 'deactivate' | 'restore' | 'delete';

function statusTone(m: MemberListItem): { accent: Accent; label: string } {
  if (m.deletedAt) return { accent: 'destructive', label: 'Deleted' };
  if (m.status === 'ACTIVE') return { accent: 'success', label: 'Active' };
  if (m.status === 'FROZEN') return { accent: 'aqua', label: 'Frozen' };
  return { accent: 'warning', label: 'Inactive' };
}

interface MemberCardProps {
  member: MemberListItem;
  index: number;
  variant: 'grid' | 'list';
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

export function MemberCard({ member: m, index, variant, selected, onToggleSelect, canManage, canDelete, canRestore, canAssignMembership, canRenew, canCheckIn, onRequestAction }: MemberCardProps) {
  const symbol = useCurrencySymbol();
  const renewMembership = useRenewMembership();
  const manualCheckIn = useManualCheckIn();
  const outstanding = Number(m.outstandingAmount);
  const tone = statusTone(m);
  const cm = m.currentMembership;
  const initials = m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const selectable = canManage || canDelete || canRestore;

  const start = cm ? new Date(cm.startDate).getTime() : 0;
  const end = cm ? new Date(cm.endDate).getTime() : 0;
  const total = cm ? Math.max(1, Math.ceil((end - start) / 86_400_000)) : 0;
  const daysLeft = cm ? Math.max(0, Math.ceil((end - Date.now()) / 86_400_000)) : 0;
  const pending = cm?.status === 'PENDING';
  const barAccent: Accent = !cm || daysLeft === 0 ? 'destructive' : daysLeft <= 7 ? 'warning' : tone.accent;

  const handleRenew = () =>
    renewMembership.mutate(
      { id: m.id, payload: {} },
      { onSuccess: () => toast.success('Membership renewed.'), onError: (err) => toast.error(toMemberError(err).message) },
    );
  const handlePunchIn = () =>
    manualCheckIn.mutate(
      { memberId: m.id, branchId: m.branch.id },
      { onSuccess: () => toast.success(`${m.name} checked in.`), onError: (err) => toast.error(toAttendanceError(err).message) },
    );

  const menu =
    selectable || canAssignMembership ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 rounded-lg text-white hover:bg-white/25 hover:text-white" aria-label={`More actions for ${m.name}`}>
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
    ) : null;

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="min-w-0 flex-1" disabled={!m.phone} asChild>
        <a href={m.phone ? `tel:${m.phone}` : undefined} aria-disabled={!m.phone}>
          <Phone className="size-3.5" /> Call
        </a>
      </Button>
      <Button variant="outline" size="sm" className="min-w-0 flex-1" disabled={!m.phone} asChild>
        <a href={m.phone ? `https://wa.me/${toWhatsAppNumber(m.phone)}` : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!m.phone}>
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
      </Button>
      {outstanding > 0 && !m.deletedAt ? (
        <Button variant="outline" size="sm" className="min-w-0 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" asChild>
          <Link href={`/members/${m.id}`}>
            <Wallet className="size-3.5" /> Pay link
          </Link>
        </Button>
      ) : canRenew && !m.deletedAt && cm ? (
        <Button variant="outline" size="sm" className="min-w-0 flex-1" disabled={renewMembership.isPending} onClick={handleRenew}>
          <RefreshCw className="size-3.5" /> {renewMembership.isPending ? 'Renewing…' : 'Renew'}
        </Button>
      ) : null}
      {canCheckIn && !m.deletedAt ? (
        <Button size="sm" className="min-w-0 flex-1 border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }} disabled={manualCheckIn.isPending} onClick={handlePunchIn}>
          <UserCheck className="size-3.5" /> {manualCheckIn.isPending ? 'Checking in…' : 'Punch in'}
        </Button>
      ) : null}
    </div>
  );

  const duePill =
    outstanding > 0 ? (
      <span className="rounded-full px-2.5 py-0.5 text-[13px] font-extrabold tabular-nums" style={{ backgroundColor: tint('destructive', 13), color: 'var(--destructive)' }}>
        Due {formatMoney(symbol, outstanding)}
      </span>
    ) : (
      <span className="rounded-full px-2.5 py-0.5 text-[13px] font-extrabold" style={{ backgroundColor: tint('success', 13), color: 'var(--success)' }}>
        Paid up
      </span>
    );

  const validity = cm ? (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{pending ? <b className="text-foreground">Starts {new Date(cm.startDate).toLocaleDateString()}</b> : daysLeft > 0 ? <><b className="text-foreground">{daysLeft} days</b> left</> : <b className="text-foreground">Expired</b>}</span>
        <span className="tabular-nums">{total}-day plan</span>
      </div>
      <ProgressBar percent={pending ? 100 : (daysLeft / total) * 100} accent={barAccent} />
    </div>
  ) : (
    <p className="text-xs text-muted-foreground">No membership assigned.</p>
  );

  const photo = (
    <Link href={`/members/${m.id}`} className="shrink-0">
      <span
        className="block rounded-full p-[3px] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105"
        style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone.accent)}, color-mix(in oklch, ${accentVar(tone.accent)} 40%, white), var(--chart-7), ${accentVar(tone.accent)})` }}
      >
        <Avatar className={variant === 'grid' ? 'size-[74px] border-[3px] border-card' : 'size-12 border-2 border-card'}>
          {m.profilePhotoUrl ? <AvatarImage src={m.profilePhotoUrl} alt="" /> : null}
          <AvatarFallback className="text-lg font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone.accent)}, var(--chart-7))` }}>
            {initials}
          </AvatarFallback>
        </Avatar>
      </span>
    </Link>
  );

  const motionProps = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: Math.min(index * 0.04, 0.5) },
  } as const;

  if (variant === 'list') {
    return (
      <motion.article
        {...motionProps}
        whileHover={{ x: 4 }}
        className={`group grid items-center gap-x-4 gap-y-3 rounded-2xl border bg-card p-3 pr-4 shadow-xs transition-shadow hover:shadow-md sm:grid-cols-[auto_auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] ${selected ? 'ring-2 ring-primary' : ''}`}
      >
        {selectable ? <Checkbox checked={selected} onCheckedChange={(c) => onToggleSelect(c === true)} aria-label={`Select ${m.name}`} /> : <span />}
        {photo}
        <div className="min-w-0">
          <Link href={`/members/${m.id}`} className="block truncate font-bold hover:underline">{m.name}</Link>
          <p className="truncate text-xs text-muted-foreground">
            {m.memberId} · {m.phone ?? 'no phone'}
          </p>
          <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: accentVar(tone.accent) }}>
            <i className="size-1.5 rounded-full" style={{ background: accentVar(tone.accent) }} /> {tone.label}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="truncate rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: tint(tone.accent, 14), color: accentVar(tone.accent) }}>{cm?.planName ?? 'No plan'}</span>
            {duePill}
          </div>
        </div>
        {validity}
        <div className="sm:w-[300px]">{actions}</div>
        {menu ? <div className="rounded-lg bg-muted/60 [&_button]:text-foreground">{menu}</div> : null}
      </motion.article>
    );
  }

  return (
    <motion.article
      {...motionProps}
      whileHover={{ y: -5 }}
      className={`group relative overflow-hidden rounded-3xl border bg-card shadow-xs transition-shadow duration-300 hover:shadow-xl ${selected ? 'ring-2 ring-primary' : ''}`}
      style={{ ['--tone' as string]: accentVar(tone.accent) }}
    >
      <div className="relative h-[74px]" style={{ backgroundImage: `linear-gradient(120deg, ${accentVar(tone.accent)}, color-mix(in oklch, ${accentVar(tone.accent)} 40%, var(--chart-7)))` }}>
        <div aria-hidden className="absolute inset-0 opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 1px, transparent 1px 12px)' }} />
        <div className="absolute inset-x-3 top-2.5 flex items-center gap-2">
          {selectable ? <Checkbox className="border-white/70 bg-white/20 data-[state=checked]:bg-white data-[state=checked]:text-primary" checked={selected} onCheckedChange={(c) => onToggleSelect(c === true)} aria-label={`Select ${m.name}`} /> : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            <i className="size-1.5 rounded-full bg-white" /> {tone.label}
          </span>
          <span className="ml-auto">{menu}</span>
        </div>
      </div>
      <div className="absolute left-[18px] top-[38px] z-10">{photo}</div>

      <div className="space-y-3.5 px-[18px] pb-4 pt-[46px]">
        <div className="min-w-0">
          <Link href={`/members/${m.id}`} className="block truncate text-[17px] font-extrabold tracking-tight hover:underline">{m.name}</Link>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>{m.memberId}</span>
            {m.gender ? <><i className="size-[3px] rounded-full bg-muted-foreground" /><span>{m.gender.charAt(0)}{m.gender.slice(1).toLowerCase()}</span></> : null}
            <i className="size-[3px] rounded-full bg-muted-foreground" />
            <span>Joined {new Date(m.joiningDate).toLocaleDateString()}</span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="truncate rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: tint(tone.accent, 14), color: accentVar(tone.accent) }}>{cm?.planName ?? 'No plan'}</span>
          {duePill}
        </div>

        {validity}

        <div className="grid grid-cols-3 gap-2">
          {[
            { v: String(m.visitsThisMonth), l: 'Visits this month' },
            { v: m.lastCheckInAt ? formatRelativeTime(m.lastCheckInAt) : 'Never', l: 'Last visit' },
            { v: m.trainer ? m.trainer.name.split(' ')[0]! : '—', l: 'Trainer' },
          ].map((s) => (
            <div key={s.l} className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone.accent, 7), borderColor: tint(tone.accent, 16) }}>
              <b className="block truncate text-[14px] font-extrabold tabular-nums">{s.v}</b>
              <span className="text-[11px] text-muted-foreground">{s.l}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-[12.5px] text-muted-foreground">
          <p className="flex items-center gap-2"><MapPin className="size-3.5 shrink-0" style={{ color: accentVar(tone.accent) }} /> <span className="truncate">{m.branch.name}</span></p>
          <p className="flex items-center gap-2"><Phone className="size-3.5 shrink-0" style={{ color: accentVar(tone.accent) }} /> {m.phone ?? '—'}</p>
          {cm ? <p className="flex items-center gap-2"><Calendar className="size-3.5 shrink-0" style={{ color: accentVar(tone.accent) }} /> Plan ends {new Date(cm.endDate).toLocaleDateString()}</p> : null}
        </div>

        {actions}
      </div>
    </motion.article>
  );
}
