'use client';

import { Dumbbell } from 'lucide-react';

import type { MemberDetail } from '@/features/members/types';
import { Accent, PanelCard, ProgressBar } from './detail-ui';

export function MemberUsagePanel({ data }: { data: MemberDetail }) {
  const u = data.planUsage;
  if (!u) return null;
  const rows: Array<{ label: string; used: number; max: number; accent: Accent }> = [];
  if (u.ptSessionsIncluded > 0) rows.push({ label: 'PT sessions', used: u.ptSessionsUsed, max: u.ptSessionsIncluded, accent: 'violet' });
  if (u.groupClassesIncluded > 0) rows.push({ label: 'Group classes', used: u.groupClassesUsed, max: u.groupClassesIncluded, accent: 'aqua' });
  if (u.freezeDaysLimit !== null) rows.push({ label: 'Freeze days', used: u.freezeDaysUsed, max: u.freezeDaysLimit, accent: 'warning' });
  if (rows.length === 0) return null;

  return (
    <PanelCard icon={Dumbbell} accent="violet" title="Plan usage" delay={0.54}>
      {rows.map((r) => (
        <div key={r.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <b className="font-semibold">{r.label}</b>
            <span className="text-xs text-muted-foreground tabular-nums">
              {r.used} of {r.max}
            </span>
          </div>
          <ProgressBar percent={r.max > 0 ? (r.used / r.max) * 100 : 0} accent={r.accent} />
        </div>
      ))}
    </PanelCard>
  );
}
