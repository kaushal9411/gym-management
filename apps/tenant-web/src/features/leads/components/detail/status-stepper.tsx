'use client';

import * as React from 'react';
import { Check, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { STATUS_META } from '../../lib/lead-meta';
import { OPEN_STATUSES, type LeadStatus } from '../../types';

const STEPS: LeadStatus[] = [...OPEN_STATUSES, 'CONVERTED'];

/** Pipeline progress: reached stages filled, current highlighted. LOST shows the stage it was lost at, struck out. */
export function StatusStepper({ status, reachedIndex }: { status: LeadStatus; reachedIndex: number }) {
  const lost = status === 'LOST';
  const current = lost ? reachedIndex : STEPS.indexOf(status);
  return (
    <ol className="flex items-start overflow-x-auto pb-1" aria-label="Pipeline progress">
      {STEPS.map((st, i) => {
        const m = STATUS_META[st];
        const done = i < current || (st === 'CONVERTED' && status === 'CONVERTED');
        const isCurrent = i === current && !lost;
        return (
          <li key={st} className="flex min-w-[88px] flex-1 flex-col items-center text-center" aria-current={isCurrent ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 && 'invisible')} style={{ backgroundColor: i <= current && !lost ? m.color : 'var(--border)' }} />
              <span
                className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold', isCurrent && 'ring-4')}
                style={{
                  borderColor: done || isCurrent ? m.color : 'var(--border)',
                  backgroundColor: done ? m.color : isCurrent ? `color-mix(in oklch, ${m.color} 16%, transparent)` : 'transparent',
                  color: done ? 'white' : isCurrent ? m.color : 'var(--muted-foreground)',
                  ['--tw-ring-color' as string]: `color-mix(in oklch, ${m.color} 20%, transparent)`,
                }}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn('h-0.5 flex-1', i === STEPS.length - 1 && 'invisible')} style={{ backgroundColor: i < current && !lost ? m.color : 'var(--border)' }} />
            </div>
            <span className={cn('mt-1.5 text-[11px] font-bold leading-tight', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>{m.label}</span>
          </li>
        );
      })}
      {lost ? (
        <li className="flex min-w-[88px] flex-col items-center text-center">
          <span className="flex size-8 items-center justify-center rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--destructive) 16%, transparent)', color: 'var(--destructive)' }}>
            <XCircle className="size-4" aria-hidden />
          </span>
          <span className="mt-1.5 text-[11px] font-bold text-destructive">Lost</span>
        </li>
      ) : null}
    </ol>
  );
}
