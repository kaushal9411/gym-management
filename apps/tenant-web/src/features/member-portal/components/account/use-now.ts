'use client';

import * as React from 'react';

/** Ticking clock for countdowns / "open now". Starts `null` on the server render so SSR and first client paint match. */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
