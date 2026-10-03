'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Mail, MapPin, MoreHorizontal, Phone } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { StaffListItem, UserStatus } from '../types';

export type StaffCardAction = 'restore' | 'activate' | 'suspend' | 'deactivate' | 'delete';

const STATUS_TONE: Record<UserStatus, Accent> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'warning',
  LOCKED: 'destructive',
  SUSPENDED: 'aqua',
  DEACTIVATED: 'violet',
};
const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  PENDING_VERIFICATION: 'Pending verification',
  LOCKED: 'Locked',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};
const ROLE_LABEL: Record<StaffListItem['role'], string> = { MANAGER: 'Manager', TRAINER: 'Trainer', RECEPTIONIST: 'Receptionist' };
const WORK_STATUS_LABEL: Record<StaffListItem['workStatus'], string> = {
  WORKING: 'Working',
  ON_LEAVE: 'On leave',
  NOTICE_PERIOD: 'Notice period',
  TERMINATED: 'Terminated',
};

interface StaffCardProps {
  staff: StaffListItem;
  index: number;
  variant: 'grid' | 'list';
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  canManage: boolean;
  canActivate: boolean;
  canDelete: boolean;
  canRestore: boolean;
  onManualActivate: () => void;
  onResendActivation: () => void;
  onRequestAction: (action: StaffCardAction) => void;
}

/** Same grid/list card shape as `UserCard`/`MemberCard` — every action here calls straight back into the page's own existing handlers, nothing new. */
export function StaffCard({
  staff: s,
  index,
  variant,
  selected,
  onToggleSelect,
  canManage,
  canActivate,
  canDelete,
  canRestore,
  onManualActivate,
  onResendActivation,
  onRequestAction,
}: StaffCardProps) {
  const tone = s.deletedAt ? 'destructive' : STATUS_TONE[s.status];
  const label = s.deletedAt ? 'Deleted' : STATUS_LABEL[s.status];
  const initials = s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const selectable = canManage || canDelete || canRestore;
  const inactive = s.deletedAt || s.status === 'SUSPENDED' || s.status === 'DEACTIVATED';

  const menu = selectable || canActivate ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={variant === 'grid' ? 'size-8 rounded-lg text-white hover:bg-white/25 hover:text-white' : 'size-8'} aria-label={`Actions for ${s.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/staff/${s.id}`}>View / edit</Link>
        </DropdownMenuItem>
        {inactive ? (
          canRestore ? <DropdownMenuItem onClick={() => onRequestAction(s.deletedAt ? 'restore' : 'activate')}>Restore / activate</DropdownMenuItem> : null
        ) : s.status === 'PENDING_VERIFICATION' && canActivate ? (
          <>
            <DropdownMenuItem onClick={onManualActivate}>Manually activate</DropdownMenuItem>
            <DropdownMenuItem onClick={onResendActivation}>Resend activation email</DropdownMenuItem>
          </>
        ) : canActivate ? (
          <>
            <DropdownMenuItem onClick={() => onRequestAction('suspend')}>Suspend</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRequestAction('deactivate')}>Deactivate</DropdownMenuItem>
          </>
        ) : null}
        {!s.deletedAt && canDelete ? (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onRequestAction('delete')}>
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const avatar = (
    <Link href={`/staff/${s.id}`} className="shrink-0">
      <span
        className="block rounded-full p-[3px] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105"
        style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, white), var(--chart-7), ${accentVar(tone)})` }}
      >
        <Avatar className={variant === 'grid' ? 'size-[70px] border-[3px] border-card' : 'size-12 border-2 border-card'}>
          {s.avatarUrl ? <AvatarImage src={s.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-lg font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone)}, var(--chart-7))` }}>
            {initials}
          </AvatarFallback>
        </Avatar>
      </span>
    </Link>
  );

  const tags = (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint('violet', 14), color: accentVar('violet') }}>
        {ROLE_LABEL[s.role]}
      </span>
      <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint(tone, 14), color: accentVar(tone) }}>
        {s.status === 'ACTIVE' || s.deletedAt ? WORK_STATUS_LABEL[s.workStatus] : label}
      </span>
    </div>
  );

  const actions = (
    <div className="flex gap-2">
      <Button asChild variant="outline" size="sm" className="min-w-[112px] flex-1" disabled={!s.email}>
        <a href={`mailto:${s.email}`}>
          <Mail className="size-3.5" /> Email
        </a>
      </Button>
      {s.phone ? (
        <Button asChild variant="outline" size="sm" className="min-w-[112px] flex-1">
          <a href={`tel:${s.phone}`}>
            <Phone className="size-3.5" /> Call
          </a>
        </Button>
      ) : null}
      <Button asChild size="sm" className="min-w-[112px] flex-1 border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}>
        <Link href={`/staff/${s.id}`}>View</Link>
      </Button>
    </div>
  );

  const motionProps = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: Math.min(index * 0.04, 0.5) } } as const;

  if (variant === 'list') {
    return (
      <motion.article
        {...motionProps}
        whileHover={{ x: 4 }}
        className={`group grid items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-3 pr-4 shadow-xs transition-shadow hover:shadow-md sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] ${s.deletedAt ? 'bg-destructive/5' : ''}`}
      >
        {selectable ? <Checkbox checked={selected} onCheckedChange={(c) => onToggleSelect(c === true)} aria-label={`Select ${s.name}`} /> : <span className="hidden sm:block" />}
        <div className="flex min-w-0 items-center gap-3">
          {avatar}
          <div className="min-w-0">
            <Link href={`/staff/${s.id}`} className="block truncate font-bold hover:underline">{s.name}</Link>
            <p className="truncate text-xs text-muted-foreground">{s.employeeId} · {s.email}</p>
          </div>
        </div>
        {tags}
        <div className="min-w-0 space-y-0.5 text-[12.5px] text-muted-foreground">
          <p className="truncate">{s.primaryBranch?.branchName ?? 'No branch'}</p>
          <p className="truncate">Joined {new Date(s.joiningDate).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {menu ? <span className="rounded-lg bg-muted/60">{menu}</span> : null}
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article {...motionProps} whileHover={{ y: -5 }} className={`group relative overflow-hidden rounded-3xl border bg-card shadow-xs transition-shadow duration-300 hover:shadow-xl ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="relative h-16" style={{ backgroundImage: `linear-gradient(120deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, var(--chart-7)))` }}>
        <div aria-hidden className="absolute inset-0 opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 1px, transparent 1px 12px)' }} />
        <div className="absolute inset-x-3 top-2.5 flex items-center gap-2">
          {selectable ? <Checkbox className="border-white/70 bg-white/20 data-[state=checked]:bg-white data-[state=checked]:text-primary" checked={selected} onCheckedChange={(c) => onToggleSelect(c === true)} aria-label={`Select ${s.name}`} /> : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            <i className="size-1.5 rounded-full bg-white" /> {label}
          </span>
          <span className="ml-auto">{menu}</span>
        </div>
      </div>
      <div className="absolute left-[18px] top-[32px] z-10">{avatar}</div>

      <div className="space-y-3 px-[18px] pb-4 pt-[42px]">
        <div className="min-w-0">
          <Link href={`/staff/${s.id}`} className="block truncate text-[17px] font-extrabold tracking-tight hover:underline">{s.name}</Link>
          <p className="truncate text-[12.5px] text-muted-foreground">{s.employeeId} · {s.email}</p>
        </div>
        {tags}
        <div className="space-y-1 text-[12.5px] text-muted-foreground">
          <p className="flex items-center gap-2"><MapPin className="size-3.5 shrink-0" style={{ color: accentVar(tone) }} /> <span className="truncate">{s.primaryBranch?.branchName ?? 'No branch'}</span></p>
          <p className="flex items-center gap-2"><Calendar className="size-3.5 shrink-0" style={{ color: accentVar(tone) }} /> Joined {new Date(s.joiningDate).toLocaleDateString()}</p>
        </div>
        {actions}
      </div>
    </motion.article>
  );
}
