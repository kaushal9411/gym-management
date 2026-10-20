'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import type { ComposerState, PickedMember } from '../../lib/composer';
import type { AudienceFilter, AudienceMode } from '../../types';
import { Banner } from '../common';
import { AudienceFilters } from './audience-filters';
import { MemberPicker } from './member-picker';
import { StepCard } from './step-card';

const MODES: Array<{ value: AudienceMode; label: string }> = [
  { value: 'FILTERS', label: 'By filters' },
  { value: 'PICKED', label: 'Pick members' },
];

/** Step 1: segmented "By filters / Pick members" switch and the matching control. */
export function AudienceStep({
  state,
  onMode,
  onFilter,
  onPick,
  onUnpick,
  onClearPicked,
  error,
}: {
  state: ComposerState;
  onMode: (mode: AudienceMode) => void;
  onFilter: (patch: Partial<AudienceFilter>) => void;
  onPick: (m: PickedMember[]) => void;
  onUnpick: (ids: string[]) => void;
  onClearPicked: () => void;
  error?: string;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length;
    onMode(MODES[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <StepCard n={1} id="step-audience" title="Who should get it?" sub="Filters combine, so each one you add narrows the list.">
      <div role="tablist" aria-label="How to choose members" className="mb-3.5 inline-flex rounded-xl border bg-muted/50 p-[3px]">
        {MODES.map((m, i) => {
          const on = state.mode === m.value;
          return (
            <button
              key={m.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`aud-tab-${m.value}`}
              aria-selected={on}
              aria-controls={`aud-panel-${m.value}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onMode(m.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'min-h-11 rounded-[9px] px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9',
                on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {error ? <Banner className="mb-3">{error}</Banner> : null}
      <div role="tabpanel" id={`aud-panel-${state.mode}`} aria-labelledby={`aud-tab-${state.mode}`}>
        {state.mode === 'FILTERS' ? (
          <AudienceFilters filter={state.filter} onChange={onFilter} />
        ) : (
          <MemberPicker picked={state.picked} onPick={onPick} onUnpick={onUnpick} onClear={onClearPicked} />
        )}
      </div>
    </StepCard>
  );
}
