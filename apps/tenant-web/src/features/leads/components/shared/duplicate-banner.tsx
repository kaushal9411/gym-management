'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';

import { STATUS_META } from '../../lib/lead-meta';
import type { LeadDuplicate, LeadStatus } from '../../types';

/** Inline banner for the 409 duplicate response: one row per matching lead/member, linking to it. */
export function DuplicateBanner({ message, duplicates }: { message: string; duplicates: LeadDuplicate[] }) {
  return (
    <div role="alert" className="rounded-xl border p-3.5" style={{ borderColor: 'color-mix(in oklch, var(--warning) 50%, transparent)', backgroundColor: 'color-mix(in oklch, var(--warning) 10%, transparent)' }}>
      <p className="flex items-start gap-2 text-sm font-bold">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--warning)' }} aria-hidden />
        <span>{message}</span>
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {duplicates.map((d) => (
          <li key={`${d.type}-${d.id}`}>
            <Link href={d.type === 'MEMBER' ? `/members/${d.id}` : `/leads/${d.id}`} className="group flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{d.type === 'MEMBER' ? 'Member' : 'Open lead'}</span>
              <span className="font-semibold">{d.name}</span>
              {d.memberCode ? <span className="text-xs text-muted-foreground">{d.memberCode}</span> : null}
              {d.type === 'LEAD' && d.status && STATUS_META[d.status as LeadStatus] ? <span className="text-xs text-muted-foreground">{STATUS_META[d.status as LeadStatus].label}</span> : null}
              <span className="text-xs text-muted-foreground">matched on {d.matchedOn.join(' & ')}</span>
              <ArrowUpRight className="ml-auto size-4 text-muted-foreground group-hover:text-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
