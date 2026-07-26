'use client';

import * as React from 'react';

/**
 * Global Loading & Performance Optimization (Prompt 23) — moved here from
 * `features/onboarding/hooks/` (its only prior consumer, the subdomain
 * availability check) since it's a generic cross-feature utility, not an
 * onboarding-specific one. Debounces any fast-changing value (typed search
 * text, a slider, etc.) by `delayMs` before it's allowed to trigger a
 * dependent effect/query — the standard fix for "search requests are
 * debounced."
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
