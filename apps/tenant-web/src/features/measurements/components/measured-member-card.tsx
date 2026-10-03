'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, Calendar, UserCog } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { MeasuredMember } from '../types';
import { summarizeMeasurement } from '../utils';

const STALE_DAYS = 30;

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

interface MeasuredMemberCardProps {
  row: MeasuredMember;
  index: number;
  variant: 'grid' | 'list';
}

/** Same grid/list card shape as `MemberCard` — fronted by the real member avatar since this list is a member roster, not a plan catalog. */
export function MeasuredMemberCard({ row, index, variant }: MeasuredMemberCardProps) {
  const age = daysSince(row.latest.recordedAt);
  const tone: Accent = age <= STALE_DAYS ? 'success' : 'warning';
  const initials = row.member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const avatar = (
    <Link href={`/measurements/${row.member.id}`} className="shrink-0">
      <span
        className="block rounded-full p-[3px] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105"
        style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, white), var(--chart-7), ${accentVar(tone)})` }}
      >
        <Avatar className={variant === 'grid' ? 'size-[70px] border-[3px] border-card text-lg' : 'size-12 border-2 border-card text-sm'}>
          {row.member.profilePhotoUrl ? <AvatarImage src={row.member.profilePhotoUrl} alt="" /> : null}
          <AvatarFallback className="font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone)}, var(--chart-7))` }}>
            {initials}
          </AvatarFallback>
        </Avatar>
      </span>
    </Link>
  );

  const tags = (
    <div className="flex flex-wrap gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint('primary', 14), color: accentVar('primary') }}>
        <Building2 className="size-3" /> {row.member.branch.name}
      </span>
      <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint(tone, 14), color: accentVar(tone) }}>
        {age === 0 ? 'Today' : `${age}d ago`}
      </span>
    </div>
  );

  const stats = (
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone, 7), borderColor: tint(tone, 16) }}>
        <b className="block text-[14px] font-extrabold tabular-nums">{row.count}</b>
        <span className="text-[11px] text-muted-foreground">Entries</span>
      </div>
      <div className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone, 7), borderColor: tint(tone, 16) }}>
        <b className="flex items-center gap-1 truncate text-[14px] font-extrabold">
          <UserCog className="size-3 shrink-0" aria-hidden /> {row.member.trainer?.name ?? '—'}
        </b>
        <span className="text-[11px] text-muted-foreground">Trainer</span>
      </div>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" className="min-w-[112px] flex-1 border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}>
        <Link href={`/measurements/${row.member.id}`}>View / edit</Link>
      </Button>
    </div>
  );

  const motionProps = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: Math.min(index * 0.04, 0.5) } } as const;

  if (variant === 'list') {
    return (
      <motion.article
        {...motionProps}
        whileHover={{ x: 4 }}
        className="group grid items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-3 pr-4 shadow-xs transition-shadow hover:shadow-md sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
      >
        <div className="flex min-w-0 items-center gap-3">
          {avatar}
          <div className="min-w-0">
            <Link href={`/measurements/${row.member.id}`} className="block truncate font-bold hover:underline">{row.member.name}</Link>
            <p className="truncate text-xs text-muted-foreground">{row.member.memberId || '—'}</p>
          </div>
        </div>
        {tags}
        <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {summarizeMeasurement(row.latest)}</span>
        </div>
        <div className="flex items-center gap-1">{actions}</div>
      </motion.article>
    );
  }

  return (
    <motion.article {...motionProps} whileHover={{ y: -5 }} className="group relative overflow-hidden rounded-3xl border bg-card shadow-xs transition-shadow duration-300 hover:shadow-xl">
      <div className="relative h-16" style={{ backgroundImage: `linear-gradient(120deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, var(--chart-7)))` }}>
        <div aria-hidden className="absolute inset-0 opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 1px, transparent 1px 12px)' }} />
      </div>
      <div className="absolute left-[18px] top-[32px] z-10">{avatar}</div>

      <div className="space-y-3 px-[18px] pb-4 pt-[42px]">
        <div className="min-w-0">
          <Link href={`/measurements/${row.member.id}`} className="block truncate text-[17px] font-extrabold tracking-tight hover:underline">{row.member.name}</Link>
          <p className="truncate text-[12.5px] text-muted-foreground">{row.member.memberId || '—'} · {summarizeMeasurement(row.latest)}</p>
        </div>
        {tags}
        {stats}
        {actions}
      </div>
    </motion.article>
  );
}
