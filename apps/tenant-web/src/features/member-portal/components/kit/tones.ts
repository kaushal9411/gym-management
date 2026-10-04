import type { CSSProperties } from 'react';

/** Portal colour system: every tone is a theme token (works in light/dark, follows tenant branding for `primary`). */
export type PortalTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'orange' | 'muted';

const TONE_COLOR: Record<PortalTone, string> = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--destructive)',
  info: 'var(--chart-3)',
  violet: 'var(--chart-7)',
  orange: 'var(--chart-2)',
  muted: 'var(--muted-foreground)',
};

export const toneColor = (t: PortalTone = 'primary'): string => TONE_COLOR[t];
/** `pct`% of the tone over transparent (backgrounds, washes). */
export const toneTint = (t: PortalTone, pct = 14): string => `color-mix(in oklab, ${TONE_COLOR[t]} ${pct}%, transparent)`;
/** Icon chip: tinted square with tone-coloured glyph. */
export const toneChipStyle = (t: PortalTone = 'primary'): CSSProperties => ({ background: toneTint(t, 15), color: TONE_COLOR[t] });
/** Card header wash. */
export const toneWash = (t: PortalTone = 'primary'): string => `linear-gradient(135deg, ${toneTint(t, 12)}, transparent 70%)`;
/** Tenant-primary hero gradient + diagonal stripe overlay (white text on top). */
export const HERO_GRADIENT = 'linear-gradient(135deg, var(--primary) 0%, color-mix(in oklab, var(--primary) 78%, var(--tenant-secondary, var(--primary))) 55%, color-mix(in oklab, var(--primary) 62%, black) 100%)';
export const HERO_STRIPES = 'repeating-linear-gradient(135deg, rgb(255 255 255 / 0.07) 0 2px, transparent 2px 16px)';
