'use client';

import * as React from 'react';

import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { cn } from '@/lib/utils';

/** Keep the splash on screen at least this long once mounted, so a fast hydration doesn't flash it in and out abruptly. */
const MIN_VISIBLE_MS = 200;
/** Fade duration once the minimum has elapsed. */
const FADE_MS = 200;

/**
 * Global Loading & Performance Optimization (Prompt 23) — covers "initial
 * application load." Rendered as a plain `'use client'` component directly
 * in the root layout (a sibling of `AppProviders`, not nested inside it),
 * so it needs no store/query-client/tenant context to exist — it's on
 * screen in the server-rendered HTML from first byte (client components
 * still render on the server for the initial response) and fades out via
 * its own `useEffect` once hydration completes, no earlier than
 * `MIN_VISIBLE_MS` to avoid a jarring flash for very fast loads.
 */
export function InitialLoadOverlay() {
  const [mounted, setMounted] = React.useState(false);
  const [fading, setFading] = React.useState(false);
  const [removed, setRemoved] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const fadeTimer = setTimeout(() => setFading(true), MIN_VISIBLE_MS);
    const removeTimer = setTimeout(() => setRemoved(true), MIN_VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (removed) return null;

  return (
    <div
      className={cn('transition-opacity ease-out', fading ? 'opacity-0' : 'opacity-100')}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      aria-hidden={mounted ? true : undefined}
    >
      <FullScreenLoader label="Loading…" />
    </div>
  );
}
