'use client';

import { motion } from 'framer-motion';
import { Dumbbell, Flame, MoreHorizontal, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { DifficultyLevel, Exercise } from '../types';

export type ExerciseCardAction = 'edit' | 'delete' | 'restore';

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };
const DIFFICULTY_ACCENT: Record<DifficultyLevel, Accent> = { BEGINNER: 'success', INTERMEDIATE: 'warning', ADVANCED: 'destructive' };

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  variant: 'grid' | 'list';
  canUpdate: boolean;
  canDelete: boolean;
  canRestore: boolean;
  onRequestAction: (action: ExerciseCardAction) => void;
}

/** Same grid/list card shape as `WorkoutPlanCard`/`MembershipPlanCard`. */
export function ExerciseCard({ exercise: ex, index, variant, canUpdate, canDelete, canRestore, onRequestAction }: ExerciseCardProps) {
  const tone: Accent = ex.deletedAt ? 'destructive' : ex.isActive ? 'success' : 'warning';
  const label = ex.deletedAt ? 'Deleted' : ex.isActive ? 'Active' : 'Inactive';
  const difficultyAccent = DIFFICULTY_ACCENT[ex.difficultyLevel];

  const menu = canUpdate || canDelete || canRestore ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={variant === 'grid' ? 'size-8 rounded-lg text-white hover:bg-white/25 hover:text-white' : 'size-8'} aria-label={`Actions for ${ex.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdate ? <DropdownMenuItem onClick={() => onRequestAction('edit')}>Edit</DropdownMenuItem> : null}
        {ex.deletedAt ? (
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
        className="block overflow-hidden rounded-full p-[3px] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105"
        style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, white), var(--chart-7), ${accentVar(tone)})` }}
      >
        <span className={`flex items-center justify-center overflow-hidden rounded-full border-card bg-card ${variant === 'grid' ? 'size-[70px] border-[3px]' : 'size-12 border-2'}`}>
          {ex.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL, not an optimizable remote image
            <img src={ex.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span
              className="flex size-full items-center justify-center text-white"
              style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone)}, var(--chart-7))` }}
            >
              <Dumbbell className={variant === 'grid' ? 'size-7' : 'size-5'} aria-hidden />
            </span>
          )}
        </span>
      </span>
    </button>
  );

  const tags = (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint(difficultyAccent, 14), color: accentVar(difficultyAccent) }}>
        {DIFFICULTY_LABELS[ex.difficultyLevel]}
      </span>
      {ex.category ? (
        <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint('primary', 14), color: accentVar('primary') }}>
          {ex.category}
        </span>
      ) : null}
    </div>
  );

  const stats = (
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone, 7), borderColor: tint(tone, 16) }}>
        <b className="flex items-center gap-1 truncate text-[14px] font-extrabold tabular-nums">
          <Timer className="size-3 shrink-0" aria-hidden /> {ex.defaultSets ?? '—'}×{ex.defaultReps ?? '—'}
        </b>
        <span className="text-[11px] text-muted-foreground">Sets × reps</span>
      </div>
      <div className="min-w-0 rounded-xl border p-2" style={{ backgroundColor: tint(tone, 7), borderColor: tint(tone, 16) }}>
        <b className="flex items-center gap-1 truncate text-[14px] font-extrabold tabular-nums">
          <Flame className="size-3 shrink-0" aria-hidden /> {ex.caloriesBurnEstimate ?? '—'}
        </b>
        <span className="text-[11px] text-muted-foreground">Calories</span>
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
        className={`group grid items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-3 pr-4 shadow-xs transition-shadow hover:shadow-md sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] ${ex.deletedAt ? 'bg-destructive/5' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <div className="min-w-0">
            <p className="truncate font-bold">{ex.name}</p>
            <p className="truncate text-xs text-muted-foreground">{ex.muscleGroup ?? 'No muscle group set'}</p>
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: accentVar(tone) }}>
              <i className="size-1.5 rounded-full" style={{ background: accentVar(tone) }} /> {label}
            </span>
          </div>
        </div>
        {tags}
        <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
          <span>{ex.equipment ?? 'No equipment'}</span>
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
          <p className="truncate text-[17px] font-extrabold tracking-tight">{ex.name}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{ex.muscleGroup ?? 'No muscle group'} · {ex.equipment ?? 'No equipment'}</p>
        </div>
        {tags}
        {stats}
        {actions}
      </div>
    </motion.article>
  );
}
