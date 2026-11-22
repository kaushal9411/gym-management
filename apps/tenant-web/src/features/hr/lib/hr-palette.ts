import type { CSSProperties } from 'react';
import {
  Ban,
  BadgeCheck,
  Check,
  CheckCheck,
  CircleDashed,
  Clock,
  Contrast,
  Hourglass,
  Moon,
  Plane,
  Star,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * The ONE place HR colours live. Every colour is a theme token (success /
 * warning / destructive / chart-N) so tenant branding and dark mode keep
 * working; each tone also carries a shape (icon) and a label so status is never
 * conveyed by colour alone.
 */
export type HrTone =
  | 'present'
  | 'absent'
  | 'half'
  | 'late'
  | 'leave'
  | 'holiday'
  | 'off'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'paid'
  | 'draft'
  | 'none';

export interface ToneMeta {
  color: string;
  label: string;
  icon: LucideIcon;
  /** Short glyph used in dense calendar cells next to the icon. */
  glyph: string;
}

export const TONES: Record<HrTone, ToneMeta> = {
  present: { color: 'var(--success)', label: 'Present', icon: Check, glyph: 'P' },
  absent: { color: 'var(--destructive)', label: 'Absent', icon: X, glyph: 'A' },
  half: { color: 'var(--warning)', label: 'Half day', icon: Contrast, glyph: 'H' },
  late: { color: 'var(--chart-2)', label: 'Late', icon: Clock, glyph: 'L' },
  leave: { color: 'var(--chart-7)', label: 'On leave', icon: Plane, glyph: 'LV' },
  holiday: { color: 'var(--chart-3)', label: 'Holiday', icon: Star, glyph: 'HD' },
  off: { color: 'var(--muted-foreground)', label: 'Weekly off', icon: Moon, glyph: 'O' },
  pending: { color: 'var(--warning)', label: 'Pending', icon: Hourglass, glyph: '?' },
  approved: { color: 'var(--success)', label: 'Approved', icon: CheckCheck, glyph: 'OK' },
  rejected: { color: 'var(--destructive)', label: 'Rejected', icon: Ban, glyph: 'NO' },
  cancelled: { color: 'var(--muted-foreground)', label: 'Cancelled', icon: Undo2, glyph: 'C' },
  paid: { color: 'var(--success)', label: 'Paid', icon: BadgeCheck, glyph: 'Rs' },
  draft: { color: 'var(--chart-5)', label: 'Draft', icon: CircleDashed, glyph: 'D' },
  none: { color: 'var(--muted-foreground)', label: 'Not marked', icon: CircleDashed, glyph: '-' },
};

export const mix = (color: string, percent: number, into = 'transparent'): string => `color-mix(in oklch, ${color} ${percent}%, ${into})`;

/** Soft tinted background + coloured text. */
export const toneStyle = (tone: HrTone, percent = 14): CSSProperties => ({ color: TONES[tone].color, backgroundColor: mix(TONES[tone].color, percent) });

/** Colour for a leave type: its own configured colour if it is a CSS colour, else a stable token by index. */
const LEAVE_FALLBACK = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-7)', 'var(--chart-4)', 'var(--chart-6)', 'var(--chart-8)'] as const;
export function leaveTypeColor(color: string | null | undefined, index = 0): string {
  const c = (color ?? '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(c) || /^(oklch|hsl|rgb)\(/i.test(c) || /^var\(--/.test(c)) return c;
  return LEAVE_FALLBACK[Math.abs(index) % LEAVE_FALLBACK.length]!;
}

/** Selectable swatches for the leave-type colour picker. Stored as hex (the API validates hex); same family as the seeded leave types. */
export const LEAVE_COLOR_CHOICES = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ef4444', label: 'Red' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#64748b', label: 'Slate' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#8b5cf6', label: 'Violet' },
];

/** Hero gradient (white text on top). Deliberately distinct from the other modules: teal -> indigo -> violet. */
export const HR_HERO_BG =
  'radial-gradient(900px 340px at 90% -35%, color-mix(in oklch, #8b5cf6 70%, transparent), transparent 60%), radial-gradient(600px 260px at 0% 120%, color-mix(in oklch, #14b8a6 55%, transparent), transparent 60%), linear-gradient(115deg, #0f766e, #3730a3 58%, #6d28d9)';

/** Solid pill / active-tab gradient and the ink colour used on white hero buttons. */
export const HR_PILL_BG = 'linear-gradient(115deg, #0f766e, #3730a3 70%, #6d28d9)';
export const HR_INK = '#3730a3';

/** Avatar gradients (initials chips) — deterministic per name. */
export const HR_AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0f766e,#14b8a6)',
  'linear-gradient(135deg,#3730a3,#6366f1)',
  'linear-gradient(135deg,#6d28d9,#a855f7)',
  'linear-gradient(135deg,#be185d,#f472b6)',
  'linear-gradient(135deg,#c2410c,#fb923c)',
  'linear-gradient(135deg,#0369a1,#38bdf8)',
];
