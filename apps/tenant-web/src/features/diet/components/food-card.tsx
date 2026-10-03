'use client';

import { motion } from 'framer-motion';
import { Apple, Beef, Flame, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { Food } from '../types';

export type FoodCardAction = 'edit' | 'delete' | 'restore';

interface FoodCardProps {
  food: Food;
  index: number;
  variant: 'grid' | 'list';
  canUpdate: boolean;
  canDelete: boolean;
  canRestore: boolean;
  onRequestAction: (action: FoodCardAction) => void;
}

/** Same grid/list card shape as `ExerciseCard`/`WorkoutPlanCard`. */
export function FoodCard({ food: f, index, variant, canUpdate, canDelete, canRestore, onRequestAction }: FoodCardProps) {
  const tone: Accent = f.deletedAt ? 'destructive' : f.isActive ? 'success' : 'warning';
  const label = f.deletedAt ? 'Deleted' : f.isActive ? 'Active' : 'Inactive';

  const menu = canUpdate || canDelete || canRestore ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={variant === 'grid' ? 'size-8 rounded-lg text-white hover:bg-white/25 hover:text-white' : 'size-8'} aria-label={`Actions for ${f.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdate ? <DropdownMenuItem onClick={() => onRequestAction('edit')}>Edit</DropdownMenuItem> : null}
        {f.deletedAt ? (
          canRestore ? <DropdownMenuItem onClick={() => onRequestAction('restore')}>Restore</DropdownMenuItem> : null
        ) : canDelete ? (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onRequestAction('delete')}>
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const icon = (
    <button type="button" onClick={() => onRequestAction('edit')} className="shrink-0">
      <span
        className="block rounded-full p-[3px] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105"
        style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, white), var(--chart-7), ${accentVar(tone)})` }}
      >
        <span
          className={`flex items-center justify-center rounded-full text-white ${variant === 'grid' ? 'size-[70px] border-[3px] border-card' : 'size-12 border-2 border-card'}`}
          style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone)}, var(--chart-7))` }}
        >
          <Apple className={variant === 'grid' ? 'size-7' : 'size-5'} aria-hidden />
        </span>
      </span>
    </button>
  );

  const tags = (
    <div className="flex flex-wrap gap-1.5">
      {f.category ? (
        <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint('primary', 14), color: accentVar('primary') }}>
          {f.category}
        </span>
      ) : null}
      {f.servingSize ? (
        <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint('aqua', 14), color: accentVar('aqua') }}>
          {f.servingSize}
        </span>
      ) : null}
    </div>
  );

  const stats = (
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone, 7), borderColor: tint(tone, 16) }}>
        <b className="flex items-center gap-1 truncate text-[14px] font-extrabold tabular-nums">
          <Flame className="size-3 shrink-0" aria-hidden /> {f.calories ?? '—'}
        </b>
        <span className="text-[11px] text-muted-foreground">Calories</span>
      </div>
      <div className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone, 7), borderColor: tint(tone, 16) }}>
        <b className="flex items-center gap-1 truncate text-[14px] font-extrabold tabular-nums">
          <Beef className="size-3 shrink-0" aria-hidden /> {f.protein ?? '—'}g
        </b>
        <span className="text-[11px] text-muted-foreground">Protein</span>
      </div>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="min-w-[112px] flex-1" onClick={() => onRequestAction('edit')}>
        Edit
      </Button>
    </div>
  );

  const motionProps = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: Math.min(index * 0.04, 0.5) } } as const;

  if (variant === 'list') {
    return (
      <motion.article
        {...motionProps}
        whileHover={{ x: 4 }}
        className={`group grid items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-3 pr-4 shadow-xs transition-shadow hover:shadow-md sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] ${f.deletedAt ? 'bg-destructive/5' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <div className="min-w-0">
            <p className="truncate font-bold">{f.name}</p>
            <p className="truncate text-xs text-muted-foreground">{f.servingSize ?? 'No serving size set'}</p>
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: accentVar(tone) }}>
              <i className="size-1.5 rounded-full" style={{ background: accentVar(tone) }} /> {label}
            </span>
          </div>
        </div>
        {tags}
        <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
          <span>{f.calories ?? '—'} kcal</span>
          <span>{f.protein ?? '—'}g protein</span>
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
          <p className="truncate text-[17px] font-extrabold tracking-tight">{f.name}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{f.servingSize ?? 'No serving size set'}</p>
        </div>
        {tags}
        {stats}
        {actions}
      </div>
    </motion.article>
  );
}
