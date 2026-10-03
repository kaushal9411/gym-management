'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Copy, IdCard, MoreHorizontal, Tag, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { MembershipPlan } from '../types';
import { computePlanPrice } from '../utils/plan-pricing';

export type PlanCardAction = 'activate' | 'deactivate' | 'restore' | 'delete' | 'duplicate';

interface MembershipPlanCardProps {
  plan: MembershipPlan;
  index: number;
  variant: 'grid' | 'list';
  currencySymbol: string;
  branchNameById: Map<string, string>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canRestore: boolean;
  onRequestAction: (action: PlanCardAction) => void;
}

/** Same grid/list card shape as `BranchCard`/`StaffCard`. */
export function MembershipPlanCard({ plan: p, index, variant, currencySymbol, branchNameById, canCreate, canUpdate, canDelete, canRestore, onRequestAction }: MembershipPlanCardProps) {
  const tone: Accent = p.deletedAt ? 'destructive' : p.isActive ? 'success' : 'warning';
  const label = p.deletedAt ? 'Deleted' : p.isActive ? 'Active' : 'Inactive';
  const initials = p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const { basePrice, finalPrice } = computePlanPrice(p);
  const hasAdjustment = Math.abs(finalPrice - basePrice) >= 0.005;
  const branchAccess = p.gymAccessAllBranches
    ? 'All branches'
    : (p.accessBranchIds ?? []).map((id) => branchNameById.get(id) ?? id).join(', ') || 'No branches';

  const menu = canCreate || canUpdate || canDelete || canRestore ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={variant === 'grid' ? 'size-8 rounded-lg text-white hover:bg-white/25 hover:text-white' : 'size-8'} aria-label={`Actions for ${p.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/memberships/${p.id}`}>View / edit</Link>
        </DropdownMenuItem>
        {canCreate ? (
          <DropdownMenuItem onClick={() => onRequestAction('duplicate')}>
            <Copy className="size-4" /> Duplicate
          </DropdownMenuItem>
        ) : null}
        {p.deletedAt ? (
          canRestore ? <DropdownMenuItem onClick={() => onRequestAction('restore')}>Restore</DropdownMenuItem> : null
        ) : canUpdate ? (
          p.isActive ? (
            <DropdownMenuItem onClick={() => onRequestAction('deactivate')}>Deactivate</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onRequestAction('activate')}>Activate</DropdownMenuItem>
          )
        ) : null}
        {!p.deletedAt && canDelete ? (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onRequestAction('delete')}>
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const icon = (
    <Link href={`/memberships/${p.id}`} className="shrink-0">
      <span
        className="block rounded-full p-[3px] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105"
        style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, white), var(--chart-7), ${accentVar(tone)})` }}
      >
        <span
          className={`flex items-center justify-center rounded-full font-extrabold text-white ${variant === 'grid' ? 'size-[70px] border-[3px] border-card text-lg' : 'size-12 border-2 border-card text-sm'}`}
          style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone)}, var(--chart-7))` }}
        >
          {initials}
        </span>
      </span>
    </Link>
  );

  const tags = (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint('primary', 14), color: accentVar('primary') }}>
        {p.planCode}
      </span>
      {p.category ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint('violet', 14), color: accentVar('violet') }}>
          <Tag className="size-3" /> {p.category}
        </span>
      ) : null}
    </div>
  );

  const stats = (
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone, 7), borderColor: tint(tone, 16) }}>
        <b className="block truncate text-[14px] font-extrabold tabular-nums">
          {currencySymbol}{finalPrice.toFixed(2)}
        </b>
        <span className="text-[11px] text-muted-foreground">{hasAdjustment ? `Base ${currencySymbol}${basePrice.toFixed(2)}` : `/ ${p.durationValue} ${p.durationType.toLowerCase()}`}</span>
      </div>
      <div className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone, 7), borderColor: tint(tone, 16) }}>
        <b className="block text-[14px] font-extrabold tabular-nums">{p.memberCount}</b>
        <span className="text-[11px] text-muted-foreground">Members</span>
      </div>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      {canCreate ? (
        <Button variant="outline" size="sm" className="min-w-[112px] flex-1" onClick={() => onRequestAction('duplicate')}>
          <Copy className="size-3.5" /> Duplicate
        </Button>
      ) : null}
      <Button asChild size="sm" className="min-w-[112px] flex-1 border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}>
        <Link href={`/memberships/${p.id}`}>View</Link>
      </Button>
    </div>
  );

  const motionProps = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: Math.min(index * 0.04, 0.5) } } as const;

  if (variant === 'list') {
    return (
      <motion.article
        {...motionProps}
        whileHover={{ x: 4 }}
        className={`group grid items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-3 pr-4 shadow-xs transition-shadow hover:shadow-md sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] ${p.deletedAt ? 'bg-destructive/5' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <div className="min-w-0">
            <Link href={`/memberships/${p.id}`} className="block truncate font-bold hover:underline">{p.name}</Link>
            <p className="truncate text-xs text-muted-foreground">{p.durationValue} {p.durationType.toLowerCase()} · {branchAccess}</p>
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: accentVar(tone) }}>
              <i className="size-1.5 rounded-full" style={{ background: accentVar(tone) }} /> {label}
            </span>
          </div>
        </div>
        {tags}
        <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5 font-semibold" style={{ color: accentVar(tone) }}>{currencySymbol}{finalPrice.toFixed(2)}</span>
          <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {p.memberCount}</span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
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
      <div className="absolute left-[18px] top-[32px] z-10">{icon}</div>

      <div className="space-y-3 px-[18px] pb-4 pt-[42px]">
        <div className="min-w-0">
          <Link href={`/memberships/${p.id}`} className="block truncate text-[17px] font-extrabold tracking-tight hover:underline">{p.name}</Link>
          <p className="flex items-center gap-1.5 truncate text-[12.5px] text-muted-foreground"><IdCard className="size-3.5 shrink-0" style={{ color: accentVar(tone) }} /> {branchAccess}</p>
        </div>
        {tags}
        {stats}
        <div className="space-y-1 text-[12.5px] text-muted-foreground">
          <p className="truncate">{p.durationValue} {p.durationType.toLowerCase()}</p>
          <p className="truncate">{p.description || 'No description'}</p>
        </div>
        {actions}
      </div>
    </motion.article>
  );
}
