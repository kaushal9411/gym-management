'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, MapPin, MoreHorizontal, Phone, ShieldCheck, ShieldOff } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { accentVar, tint } from '@/features/members/components/detail/detail-ui';
import { formatRelativeTime } from '@/lib/format-relative-time';
import type { UserListItem } from '../types';
import { STATUS_LABEL, STATUS_TONE, displayRoleName } from './users-overview';

export type UserCardAction = 'suspend' | 'deactivate' | 'restore' | 'delete';

interface UserCardProps {
  user: UserListItem;
  index: number;
  variant: 'grid' | 'list';
  canManage: boolean;
  onAction: (action: UserCardAction) => void;
}

function signInDot(user: UserListItem): string {
  if (!user.lastLoginAt) return 'var(--warning)';
  const days = (Date.now() - new Date(user.lastLoginAt).getTime()) / 86_400_000;
  return days < 1 ? 'var(--success)' : days < 7 ? 'var(--chart-3)' : 'var(--muted-foreground)';
}

export function UserCard({ user: u, index, variant, canManage, onAction }: UserCardProps) {
  const tone = u.deletedAt ? 'destructive' : STATUS_TONE[u.status];
  const label = u.deletedAt ? 'Deleted' : STATUS_LABEL[u.status];
  const initials = u.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const branches = u.allBranches ? 'All branches' : u.branches.map((b) => b.branchName).join(', ') || 'No branch';
  const inactive = u.deletedAt || u.status === 'SUSPENDED' || u.status === 'DEACTIVATED';

  const menu = canManage ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={variant === 'grid' ? 'size-8 rounded-lg text-white hover:bg-white/25 hover:text-white' : 'size-8'} aria-label={`Actions for ${u.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/users/${u.id}`}>View / edit</Link>
        </DropdownMenuItem>
        {inactive ? (
          <DropdownMenuItem onClick={() => onAction('restore')}>Restore</DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => onAction('suspend')}>Suspend</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('deactivate')}>Deactivate</DropdownMenuItem>
          </>
        )}
        {!u.deletedAt ? (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction('delete')}>
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const avatar = (
    <Link href={`/users/${u.id}`} className="shrink-0">
      <span
        className="block rounded-full p-[3px] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105"
        style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, white), var(--chart-7), ${accentVar(tone)})` }}
      >
        <Avatar className={variant === 'grid' ? 'size-[70px] border-[3px] border-card' : 'size-12 border-2 border-card'}>
          {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-lg font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone)}, var(--chart-7))` }}>
            {initials}
          </AvatarFallback>
        </Avatar>
      </span>
    </Link>
  );

  const roleTags = u.roles.map((r) => (
    <span key={r.id} className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint(r.isSystem ? 'primary' : 'violet', 14), color: accentVar(r.isSystem ? 'primary' : 'violet') }}>
      {displayRoleName(r.name)}
    </span>
  ));
  const mfaTag = (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint(u.mfaEnabled ? 'success' : 'warning', 14), color: accentVar(u.mfaEnabled ? 'success' : 'warning') }}>
      {u.mfaEnabled ? <ShieldCheck className="size-3" /> : <ShieldOff className="size-3" />} 2FA {u.mfaEnabled ? 'on' : 'off'}
    </span>
  );
  const lastSignIn = (
    <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
      <i className="size-[9px] rounded-full" style={{ background: signInDot(u), boxShadow: `0 0 0 4px color-mix(in oklch, ${signInDot(u)} 20%, transparent)` }} />
      {u.lastLoginAt ? `Signed in ${formatRelativeTime(u.lastLoginAt)}` : 'Never signed in'}
    </p>
  );

  const motionProps = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: Math.min(index * 0.04, 0.5) } } as const;

  if (variant === 'list') {
    return (
      <motion.article
        {...motionProps}
        whileHover={{ x: 4 }}
        className={`group grid items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-3 pr-4 shadow-xs transition-shadow hover:shadow-md sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] ${u.deletedAt ? 'bg-destructive/5' : ''}`}
      >
        {avatar}
        <div className="min-w-0">
          <Link href={`/users/${u.id}`} className="block truncate font-bold hover:underline">{u.name}</Link>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: accentVar(tone) }}>
            <i className="size-1.5 rounded-full" style={{ background: accentVar(tone) }} /> {label}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">{roleTags}{mfaTag}</div>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[12.5px] text-muted-foreground">{branches}</p>
          {lastSignIn}
        </div>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="outline"><a href={`mailto:${u.email}`}><Mail className="size-3.5" /> Email</a></Button>
          {menu ? <span className="rounded-lg bg-muted/60">{menu}</span> : null}
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article {...motionProps} whileHover={{ y: -5 }} className="group relative overflow-hidden rounded-3xl border bg-card shadow-xs transition-shadow duration-300 hover:shadow-xl">
      <div className="relative h-16" style={{ backgroundImage: `linear-gradient(120deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, var(--chart-7)))` }}>
        <div aria-hidden className="absolute inset-0 opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 1px, transparent 1px 12px)' }} />
        <div className="absolute inset-x-3 top-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            <i className="size-1.5 rounded-full bg-white" /> {label}
          </span>
          <span className="ml-auto">{menu}</span>
        </div>
      </div>
      <div className="absolute left-[18px] top-[32px] z-10">{avatar}</div>

      <div className="space-y-3 px-[18px] pb-4 pt-[42px]">
        <div className="min-w-0">
          <Link href={`/users/${u.id}`} className="block truncate text-[17px] font-extrabold tracking-tight hover:underline">{u.name}</Link>
          <p className="truncate text-[12.5px] text-muted-foreground">{u.email}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">{roleTags}{mfaTag}</div>
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" style={{ color: accentVar(tone) }} /> <span className="truncate">{branches}</span>
        </p>
        {lastSignIn}
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1">
            <a href={`mailto:${u.email}`}><Mail className="size-3.5" /> Email</a>
          </Button>
          {u.phone ? (
            <Button asChild variant="outline" size="sm" className="min-w-0 flex-1">
              <a href={`tel:${u.phone}`}><Phone className="size-3.5" /> Call</a>
            </Button>
          ) : null}
          <Button asChild size="sm" className="min-w-0 flex-1 border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}>
            <Link href={`/users/${u.id}`}>View</Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
