'use client';

import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

export interface TabDef { id: string; label: string }

/** Accessible tab list (arrow keys / Home / End, roving tabindex) with an animated underline. Scrolls horizontally on narrow screens. */
export function TabBar({ tabs, active, onChange, idPrefix }: { tabs: TabDef[]; active: string; onChange: (id: string) => void; idPrefix: string }) {
  const reduce = useReducedMotion();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    const t = tabs[n]!;
    onChange(t.id);
    refs.current[t.id]?.focus();
  };

  return (
    <div data-no-print role="tablist" aria-label="Tenant sections" className="flex gap-0.5 overflow-x-auto border-b [scrollbar-width:thin]">
      {tabs.map((t, i) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            id={`${idPrefix}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn('relative shrink-0 whitespace-nowrap rounded-t-md px-3.5 py-2.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', on ? 'text-primary' : 'text-muted-foreground hover:text-primary')}
          >
            {t.label}
            {on ? <motion.span layoutId={`${idPrefix}-underline`} className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-primary" transition={reduce ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }} /> : null}
          </button>
        );
      })}
    </div>
  );
}
