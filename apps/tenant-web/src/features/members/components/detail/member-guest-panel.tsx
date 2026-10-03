'use client';

import { Gift } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGuestVisits } from '@/features/members/hooks/use-members';
import type { MemberDetail } from '@/features/members/types';
import { PanelCard, accentVar, tint } from './detail-ui';

interface Props {
  data: MemberDetail;
  canLog: boolean;
  guestName: string;
  onGuestNameChange: (v: string) => void;
  logging: boolean;
  onLog: () => void;
}

export function MemberGuestPanel({ data, canLog, guestName, onGuestNameChange, logging, onLog }: Props) {
  const visits = useGuestVisits(data.id);
  const usage = data.planUsage;
  const included = usage?.guestPassesIncluded ?? 0;
  const used = usage?.guestPassesUsed ?? 0;
  const percent = included > 0 ? Math.min(100, (used / included) * 100) : 0;
  const list = visits.data ?? [];

  return (
    <PanelCard icon={Gift} accent="warning" title="Guest visits" delay={0.46}>
      {included > 0 ? (
        <div className="flex items-center gap-4">
          <div
            className="grid size-[76px] shrink-0 place-items-center rounded-full"
            style={{ backgroundImage: `conic-gradient(${accentVar('warning')} ${percent}%, ${tint('warning', 18)} 0)` }}
          >
            <div className="grid size-[56px] place-items-center rounded-full bg-card text-base font-extrabold tabular-nums">
              {used}/{included}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">
              {used} of {included} guest {included === 1 ? 'pass' : 'passes'} used
            </p>
            <p className="text-xs text-muted-foreground">Counts against the current membership.</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This plan doesn&apos;t include guest passes.</p>
      )}

      {canLog && data.currentMembership?.status === 'ACTIVE' && included > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="guestVisitName">Guest name (optional)</Label>
            <Input id="guestVisitName" value={guestName} onChange={(e) => onGuestNameChange(e.target.value)} placeholder="Who's visiting?" />
          </div>
          <Button size="sm" variant="outline" disabled={logging} onClick={onLog}>
            {logging ? 'Logging…' : 'Log guest visit'}
          </Button>
        </div>
      ) : null}

      <div className="space-y-1.5">
        {visits.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guest visits yet.</p>
        ) : (
          list.slice(0, 5).map((g) => (
            <div key={g.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ backgroundColor: tint('warning', 9) }}>
              <span
                className="grid size-7 place-items-center rounded-full text-[11px] font-extrabold text-white"
                style={{ backgroundImage: 'linear-gradient(135deg, var(--warning), var(--destructive))' }}
              >
                {(g.guestName ?? 'G').charAt(0).toUpperCase()}
              </span>
              <b className="flex-1 truncate text-sm">{g.guestName || 'Guest'}</b>
              <span className="text-xs text-muted-foreground tabular-nums">{new Date(g.visitedAt).toLocaleDateString()}</span>
            </div>
          ))
        )}
      </div>
    </PanelCard>
  );
}
