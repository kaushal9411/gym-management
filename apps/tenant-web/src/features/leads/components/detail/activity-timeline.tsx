'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ACTIVITY_META, formatDateTime, relativeTime, STATUS_META } from '../../lib/lead-meta';
import type { LeadActivity } from '../../types';

function Event({ a }: { a: LeadActivity }) {
  const meta = ACTIVITY_META[a.type];
  const Icon = meta.icon;
  const system = meta.system;
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-border last:hidden" />
      <span
        className={cn('z-10 flex size-8 shrink-0 items-center justify-center rounded-full', system ? 'border border-dashed bg-muted text-muted-foreground' : 'text-white')}
        style={system ? undefined : { backgroundImage: 'linear-gradient(135deg, var(--chart-1), var(--chart-7))' }}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      {system ? (
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">{meta.label}</span>
            {a.type === 'STATUS_CHANGE' && a.toStatus ? (
              <span className="ml-1.5 inline-flex items-center gap-1">
                {a.fromStatus ? <>{STATUS_META[a.fromStatus].label} <ArrowRight className="size-3" aria-hidden /></> : null}
                <b style={{ color: STATUS_META[a.toStatus].color }}>{STATUS_META[a.toStatus].label}</b>
              </span>
            ) : null}
            {a.note ? <span className="ml-1.5">- {a.note}</span> : null}
          </p>
          <p className="text-[11px] text-muted-foreground" title={formatDateTime(a.createdAt)}>{a.createdBy?.name ? `${a.createdBy.name} - ` : ''}{relativeTime(a.createdAt)}</p>
        </div>
      ) : (
        <div className="min-w-0 flex-1 rounded-xl border bg-card p-3 shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-bold">{meta.label}</span>
            <span className="text-[11px] text-muted-foreground" title={formatDateTime(a.createdAt)}>{a.createdBy?.name ? `${a.createdBy.name} - ` : ''}{relativeTime(a.createdAt)}</span>
          </div>
          {a.note ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{a.note}</p> : null}
          {a.outcome ? <p className="mt-1 text-[13px] text-muted-foreground"><span className="font-semibold">Outcome:</span> {a.outcome}</p> : null}
          {a.scheduledFor ? <p className="mt-1 text-[13px] text-muted-foreground"><span className="font-semibold">Scheduled:</span> {formatDateTime(a.scheduledFor)}</p> : null}
        </div>
      )}
    </li>
  );
}

export function ActivityTimeline({ activities }: { activities: LeadActivity[] }) {
  if (!activities.length) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No activity yet.</p>;
  return <ol aria-label="Activity timeline">{activities.map((a) => <Event key={a.id} a={a} />)}</ol>;
}
