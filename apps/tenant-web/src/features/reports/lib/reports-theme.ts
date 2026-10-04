import type { CSSProperties } from 'react';

export type ReportAccent = 'members' | 'finance' | 'attendance' | 'staff' | 'operations' | 'analytics';

/** Theme-aware solid colour per accent (built from `--chart-*` tokens; `operations` blue has no token so it is a fixed mid-blue legible on both themes). */
const ACCENT_COLOR: Record<ReportAccent, string> = {
  members: 'var(--chart-1)',
  finance: 'var(--chart-3)',
  attendance: 'var(--chart-2)',
  staff: 'var(--chart-5)',
  operations: '#3b82f6',
  analytics: 'var(--chart-7)',
};

/** Saturated gradient stops (hex) for white-text heroes — same approach as `PaymentsHero`. */
const ACCENT_HERO: Record<ReportAccent, [string, string, string]> = {
  members: ['#4338ca', '#6d4ff0', '#a855f7'],
  finance: ['#0f766e', '#0d9488', '#16a34a'],
  attendance: ['#c2410c', '#ea580c', '#f59e0b'],
  staff: ['#a21caf', '#c026d3', '#ec4899'],
  operations: ['#1d4ed8', '#2563eb', '#0ea5e9'],
  analytics: ['#4338ca', '#7c3aed', '#c026d3'],
};

export const ACCENT_LABEL: Record<ReportAccent, string> = {
  members: 'Members',
  finance: 'Finance',
  attendance: 'Attendance',
  staff: 'Staff',
  operations: 'Operations',
  analytics: 'Analytics',
};

export const accentColor = (a: ReportAccent): string => ACCENT_COLOR[a];
/** Translucent tint of the accent (`percent` = colour strength) — safe on light and dark surfaces. */
export const accentTint = (a: ReportAccent, percent = 14): string => `color-mix(in oklch, ${ACCENT_COLOR[a]} ${percent}%, transparent)`;
/** Lighter/darker blends for gradients inside cards. */
export const accentMix = (a: ReportAccent, percent: number, withColor = 'white'): string => `color-mix(in oklch, ${ACCENT_COLOR[a]} ${percent}%, ${withColor})`;
/** Full hero gradient (diagonal) with a soft radial glow top-right. */
export const accentHeroGradient = (a: ReportAccent): string => {
  const [c1, c2, c3] = ACCENT_HERO[a];
  return `radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, ${c3} 75%, transparent), transparent 60%), linear-gradient(115deg, ${c1}, ${c2} 62%, ${c3})`;
};
/** Subtle card-header wash: tint fading to transparent. */
export const accentWash = (a: ReportAccent): string => `linear-gradient(135deg, ${accentTint(a, 16)}, transparent 70%)`;
/** Inline style for an icon chip (tinted bg + coloured glyph + hairline ring). */
export const accentChipStyle = (a: ReportAccent): CSSProperties => ({
  backgroundColor: accentTint(a, 16),
  color: ACCENT_COLOR[a],
  boxShadow: `0 0 0 1px ${accentTint(a, 20)}`,
});

/** Ordered categorical palette for multi-series / donut slices (CVD-ordered chart tokens). */
export const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-7)', 'var(--chart-4)', 'var(--chart-6)', 'var(--chart-8)'] as const;
export const seriesColor = (i: number): string => SERIES_COLORS[i % SERIES_COLORS.length]!;

/** Semantic colours for deltas / status. */
export const GOOD_COLOR = 'var(--success)';
export const BAD_COLOR = 'var(--destructive)';
export const NEUTRAL_COLOR = 'var(--muted-foreground)';
/** Colour of "previous period" series everywhere (dashed, muted). */
export const PREVIOUS_COLOR = 'var(--muted-foreground)';
