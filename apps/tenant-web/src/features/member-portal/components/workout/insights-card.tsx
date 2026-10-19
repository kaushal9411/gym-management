'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles, type LucideIcon } from 'lucide-react';

import { SectionCard, toneChipStyle, toneColor, toneTint, type PortalTone } from '../kit';
import type { InsightTone, WorkoutInsight } from '../../lib/workout-tracking';
import { Pop } from './workout-motion';

const STYLE: Record<InsightTone, { tone: PortalTone; icon: LucideIcon }> = {
  good: { tone: 'success', icon: CheckCircle2 },
  warn: { tone: 'warning', icon: AlertTriangle },
  tip: { tone: 'info', icon: Lightbulb },
};

/**
 * "What to do for better results": rule-based advice computed on the server from the
 * member's real logs (at most 4, by priority). Plain language, no medical claims.
 */
export function InsightsCard({ insights }: { insights: WorkoutInsight[] }) {
  if (!insights.length) return null;
  return (
    <SectionCard title="How to get better results" subtitle="Based on what you've logged" icon={Sparkles} tone="violet">
      <ul className="space-y-2.5">
        {insights.map((i, idx) => {
          const s = STYLE[i.tone];
          const Icon = s.icon;
          return (
            <Pop key={`${i.title}-${idx}`} delay={idx * 0.08}>
              <li className="flex items-start gap-3 rounded-2xl border p-3.5" style={{ background: toneTint(s.tone, 9), borderColor: toneTint(s.tone, 35) }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={toneChipStyle(s.tone)}>
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: toneColor(s.tone) }}>
                    {i.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-foreground/85">{i.body}</p>
                </div>
              </li>
            </Pop>
          );
        })}
      </ul>
    </SectionCard>
  );
}
