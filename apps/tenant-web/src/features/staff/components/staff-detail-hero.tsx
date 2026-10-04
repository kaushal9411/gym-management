'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarClock, GitBranch, History, MapPin, ShieldCheck, Star, type LucideIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CountUp, accentVar, tint, type Accent } from '@/features/members/components/detail/detail-ui';
import { useMotionSafe } from '@/features/reports/lib/motion';
import type { StaffDetail } from '../types';
import { STAFF_ROLE_OPTIONS } from './staff-role-select';

const ACTION_SKIN =
  'contents [&_button:not(.bg-destructive):not(.bg-success):not(.bg-warning)]:border [&_button:not(.bg-destructive):not(.bg-success):not(.bg-warning)]:border-white/30 [&_button:not(.bg-destructive):not(.bg-success):not(.bg-warning)]:bg-white/15 [&_button:not(.bg-destructive):not(.bg-success):not(.bg-warning)]:text-white [&_button:not(.bg-destructive):not(.bg-success):not(.bg-warning):hover]:bg-white/25';

const CHIP = 'inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur';

export function roleLabel(role: string): string {
  return STAFF_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

function statusDot(status: string, deleted: boolean): string {
  if (deleted) return 'bg-rose-300';
  if (status === 'ACTIVE') return 'bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,.35)]';
  if (status === 'PENDING_VERIFICATION') return 'bg-amber-300';
  if (status === 'SUSPENDED') return 'bg-rose-300';
  return 'bg-slate-300';
}

export function statusLabel(status: string, deleted: boolean): string {
  if (deleted) return 'Deleted';
  if (status === 'PENDING_VERIFICATION') return 'Pending activation';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

interface StaffDetailHeroProps {
  data: StaffDetail;
  /** Live (unsaved) photo so the hero previews an upload before Save. */
  avatarUrl: string | null;
  /** Primary action + the "⋯" menu — built on the page so permission gates and confirm flows stay there. */
  actions: React.ReactNode;
}

export function StaffDetailHero({ data, avatarUrl, actions }: StaffDetailHeroProps) {
  const m = useMotionSafe();
  const deleted = !!data.deletedAt;

  return (
    <motion.section
      initial={m.reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative grid gap-5 overflow-hidden rounded-3xl p-5 text-white shadow-lg sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-7"
      style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
      <div className="relative min-w-0 space-y-4">
        <Link href="/staff" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/85 transition-colors hover:text-white">
          <ArrowLeft className="size-4" aria-hidden /> Back to staff
        </Link>
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <motion.div
            initial={m.reduce ? false : { opacity: 0, rotate: -80, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="shrink-0 rounded-full p-1"
            style={{ backgroundImage: 'conic-gradient(from 210deg, #fde68a, #f9a8d4, #a5b4fc, #6ee7b7, #fde68a)' }}
          >
            <Avatar className="size-20 border-0">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-indigo-950/85 text-2xl font-extrabold text-white">{initialsOf(data.name)}</AvatarFallback>
            </Avatar>
          </motion.div>
          <div className="min-w-0 flex-1">
            <h1 className="text-balance break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{data.name}</h1>
            <p className="mt-0.5 text-sm font-medium text-white/80">
              {data.employeeId || 'No employee ID'} · joined {new Date(data.joiningDate).toLocaleDateString()}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className={CHIP}>
                <span className={`size-2 rounded-full ${statusDot(data.status, deleted)}`} aria-hidden />
                {statusLabel(data.status, deleted)}
              </span>
              <span className={CHIP}>
                <ShieldCheck className="size-3.5" aria-hidden /> {roleLabel(data.role)}
              </span>
              {data.branches.map((b) => (
                <span key={b.branchId} className={CHIP}>
                  {b.isPrimary ? <Star className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                  <span className="truncate">{b.branchName}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="relative flex flex-wrap items-center gap-2">
        <div className={ACTION_SKIN}>{actions}</div>
      </div>
    </motion.section>
  );
}

function tenureOf(joiningDate: string): { value: number; unit: string } {
  const days = Math.max(0, Math.floor((Date.now() - new Date(joiningDate).getTime()) / 86_400_000));
  if (days >= 365) return { value: Math.floor(days / 365), unit: Math.floor(days / 365) === 1 ? 'year' : 'years' };
  if (days >= 30) return { value: Math.floor(days / 30), unit: Math.floor(days / 30) === 1 ? 'month' : 'months' };
  return { value: days, unit: days === 1 ? 'day' : 'days' };
}

function relative(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins || 1} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  const days = Math.round(mins / 1440);
  return days < 31 ? `${days} d ago` : new Date(iso).toLocaleDateString();
}

interface Tile {
  icon: LucideIcon;
  accent: Accent;
  label: string;
  value: React.ReactNode;
  hint: string;
}

/** Real fields only: status, tenure (from joiningDate), branch count, last sign-in. No 2FA flag exists on the staff DTO, so none is shown. */
export function StaffDetailKpis({ data }: { data: StaffDetail }) {
  const m = useMotionSafe();
  const deleted = !!data.deletedAt;
  const tenure = tenureOf(data.joiningDate);
  const statusAccent: Accent = deleted || data.status === 'SUSPENDED' ? 'destructive' : data.status === 'ACTIVE' ? 'success' : data.status === 'PENDING_VERIFICATION' ? 'warning' : 'primary';
  const tiles: Tile[] = [
    { icon: ShieldCheck, accent: statusAccent, label: 'Status', value: statusLabel(data.status, deleted), hint: `${roleLabel(data.role)} · ${data.workStatus.replace('_', ' ').toLowerCase()}` },
    { icon: CalendarClock, accent: 'primary', label: 'Tenure', value: <><CountUp value={tenure.value} /> <span className="text-base font-bold">{tenure.unit}</span></>, hint: `Since ${new Date(data.joiningDate).toLocaleDateString()}` },
    { icon: GitBranch, accent: 'aqua', label: 'Branches', value: <CountUp value={data.branches.length} />, hint: data.primaryBranch ? `Primary: ${data.primaryBranch.branchName}` : 'No primary branch' },
    {
      icon: History,
      accent: 'violet',
      label: 'Last sign-in',
      value: data.lastLoginAt ? relative(data.lastLoginAt) : 'Never',
      hint: data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString() : data.status === 'PENDING_VERIFICATION' ? 'Has not activated yet' : 'No sign-in recorded',
    },
  ];
  return (
    <motion.div
      variants={m.staggerContainer(0.07, 0.1)}
      initial={m.initial}
      animate="show"
      className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4"
    >
      {tiles.map((t) => (
        <motion.div key={t.label} variants={m.fadeUp} className="relative min-w-0 overflow-hidden rounded-2xl border bg-card p-4 shadow-xs">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accentVar(t.accent) }} />
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: tint(t.accent, 16), color: accentVar(t.accent) }}>
              <t.icon className="size-4" aria-hidden />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.label}</span>
          </div>
          <div className="mt-2.5 truncate text-2xl font-extrabold tabular-nums tracking-tight">{t.value}</div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.hint}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
