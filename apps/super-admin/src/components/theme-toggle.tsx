'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

const SEQUENCE = ['light', 'dark', 'system'] as const;

/** Cycles light → dark → system. Announces the active theme to AT. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  // Avoid hydration mismatch — theme is only known on the client.
  if (!mounted) return <div className="size-10" aria-hidden />;

  const current = (theme ?? 'system') as (typeof SEQUENCE)[number];
  const next = SEQUENCE[(SEQUENCE.indexOf(current) + 1) % SEQUENCE.length]!;
  const Icon = current === 'light' ? Sun : current === 'dark' ? Moon : Monitor;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${current}. Switch to ${next}.`}
      title={`Theme: ${current} — click for ${next}`}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
