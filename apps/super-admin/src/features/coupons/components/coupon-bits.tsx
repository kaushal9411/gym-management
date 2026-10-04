'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Chip } from '@/features/dashboard/components/ui';
import { cn } from '@/lib/utils';
import type { Coupon, CouponStatus } from '../types';
import { STATUS_LABEL, STATUS_TONE, TYPE_TONE, valueLabel } from './lib';

export function CopyCode({ code, className, light }: { code: string; className?: string; light?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy code ${code}`}
      onClick={() => {
        navigator.clipboard.writeText(code).then(() => { setDone(true); toast.success(`Copied ${code}`); window.setTimeout(() => setDone(false), 1500); }, () => toast.error('Copy failed'));
      }}
      className={cn('grid size-7 shrink-0 place-items-center rounded-md outline-none transition-colors focus-visible:ring-2', light ? 'text-white/80 hover:bg-white/20 focus-visible:ring-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring', className)}
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

export const StatusChip = ({ status }: { status: CouponStatus }) => <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;
export const ValueChip = ({ coupon }: { coupon: Coupon }) => <Chip tone={TYPE_TONE[coupon.type]}>{valueLabel(coupon)}</Chip>;

/** Usage bar on the enforced counter `timesRedeemed` (what /coupon/validate checks). */
export function UsageBar({ used, max }: { used: number; max: number | null }) {
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div className="min-w-[96px]">
      <p className="text-xs tabular-nums"><b>{used}</b><span className="text-muted-foreground"> / {max ?? '∞'}</span></p>
      {max ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(used, max)} aria-label="Usage">
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--chart-4)' : pct >= 80 ? 'var(--chart-4)' : 'var(--chart-1)' }} />
        </div>
      ) : null}
    </div>
  );
}
