'use client';

import { useEffect, useState } from 'react';

/** Wall clock ticking every `ms` (default 30 s). `null` until mounted (avoids hydration mismatch). */
export function useNow(ms = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
