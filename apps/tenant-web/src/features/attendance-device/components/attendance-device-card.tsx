'use client';

import { motion } from 'framer-motion';
import { Fingerprint, KeyRound, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { AttendanceDevice, AttendanceDeviceVendor } from '../types';

export type DeviceCardAction = 'activate' | 'deactivate' | 'delete' | 'regenerate-key';

const VENDOR_LABELS: Record<AttendanceDeviceVendor, string> = {
  ZKTECO: 'ZKTeco',
  ESSL: 'eSSL',
  GENERIC: 'Generic',
  OTHER: 'Other',
};

export function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never synced';
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  const days = Math.round(hours / 24);
  return days <= 3 ? `Synced ${days}d ago` : `Last synced ${new Date(lastSeenAt).toLocaleDateString()}`;
}

function syncTone(lastSeenAt: string | null): Accent {
  if (!lastSeenAt) return 'destructive';
  const hours = (Date.now() - new Date(lastSeenAt).getTime()) / 3_600_000;
  if (hours < 24) return 'success';
  if (hours < 24 * 7) return 'warning';
  return 'destructive';
}

interface AttendanceDeviceCardProps {
  device: AttendanceDevice;
  index: number;
  variant: 'grid' | 'list';
  canManage: boolean;
  onRequestAction: (action: DeviceCardAction) => void;
}

/** Same grid/list card shape as `BranchCard`/`StaffCard`. */
export function AttendanceDeviceCard({ device: d, index, variant, canManage, onRequestAction }: AttendanceDeviceCardProps) {
  const tone: Accent = d.isActive ? 'success' : 'warning';
  const sync = syncTone(d.lastSeenAt);

  const menu = canManage ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={variant === 'grid' ? 'size-8 rounded-lg text-white hover:bg-white/25 hover:text-white' : 'size-8'} aria-label={`Actions for ${d.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onRequestAction('regenerate-key')}>
          <KeyRound className="size-4" /> Regenerate key
        </DropdownMenuItem>
        {d.isActive ? (
          <DropdownMenuItem onClick={() => onRequestAction('deactivate')}>Disable</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onRequestAction('activate')}>Activate</DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onRequestAction('delete')}>
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const icon = (
    <span
      className="block shrink-0 rounded-full p-[3px] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105"
      style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, white), var(--chart-7), ${accentVar(tone)})` }}
    >
      <span
        className={`flex items-center justify-center rounded-full text-white ${variant === 'grid' ? 'size-[70px] border-[3px] border-card' : 'size-12 border-2 border-card'}`}
        style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone)}, var(--chart-7))` }}
      >
        <Fingerprint className={variant === 'grid' ? 'size-7' : 'size-5'} aria-hidden />
      </span>
    </span>
  );

  const tags = (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint('primary', 14), color: accentVar('primary') }}>
        {VENDOR_LABELS[d.vendor]}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: tint(sync, 14), color: accentVar(sync) }}>
        <i className="size-1.5 rounded-full" style={{ background: accentVar(sync) }} /> {formatLastSeen(d.lastSeenAt)}
      </span>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="min-w-[112px] flex-1" disabled={!canManage} onClick={() => onRequestAction('regenerate-key')}>
        <KeyRound className="size-3.5" /> Regenerate key
      </Button>
      {canManage ? (
        <Button
          size="sm"
          className="min-w-[112px] flex-1 border-0 text-white shadow-md"
          style={{ backgroundImage: d.isActive ? 'linear-gradient(120deg, var(--warning), var(--chart-5))' : 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
          onClick={() => onRequestAction(d.isActive ? 'deactivate' : 'activate')}
        >
          {d.isActive ? 'Disable' : 'Activate'}
        </Button>
      ) : null}
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
          {icon}
          <div className="min-w-0">
            <p className="truncate font-bold">{d.name}</p>
            <p className="truncate text-xs text-muted-foreground">{d.branchName}</p>
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: accentVar(tone) }}>
              <i className="size-1.5 rounded-full" style={{ background: accentVar(tone) }} /> {d.isActive ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>
        {tags}
        <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
          <span>{d.branchName}</span>
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
            <i className="size-1.5 rounded-full bg-white" /> {d.isActive ? 'Active' : 'Disabled'}
          </span>
          <span className="ml-auto">{menu}</span>
        </div>
      </div>
      <div className="absolute left-[18px] top-[32px] z-10">{icon}</div>

      <div className="space-y-3 px-[18px] pb-4 pt-[42px]">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-extrabold tracking-tight">{d.name}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{d.branchName}</p>
        </div>
        {tags}
        {actions}
      </div>
    </motion.article>
  );
}
