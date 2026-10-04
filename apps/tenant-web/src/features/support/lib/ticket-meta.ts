import { CheckCircle2, CircleDot, Clock3, Lock, type LucideIcon } from 'lucide-react';

import { accentColor } from '@/features/reports/lib/reports-theme';
import type { TicketPriority, TicketStatus } from '../types';

export const tint = (color: string, pct = 14): string => `color-mix(in oklch, ${color} ${pct}%, transparent)`;

/** "Communication / support" accent composed locally (the shared ReportAccent union has none): teal -> blue hero. */
export const SUPPORT_COLOR = accentColor('operations');
export const SUPPORT_HERO_GRADIENT =
  'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #14b8a6 75%, transparent), transparent 60%), linear-gradient(115deg, #1d4ed8, #0e7490 62%, #0d9488)';

export const STATUS_META: Record<TicketStatus, { label: string; color: string; icon: LucideIcon }> = {
  OPEN: { label: 'Open', color: accentColor('attendance'), icon: CircleDot },
  IN_PROGRESS: { label: 'In progress', color: accentColor('operations'), icon: Clock3 },
  RESOLVED: { label: 'Resolved', color: 'var(--success)', icon: CheckCircle2 },
  CLOSED: { label: 'Closed', color: 'var(--muted-foreground)', icon: Lock },
};

export const PRIORITY_META: Record<TicketPriority, { label: string; color: string; hint: string }> = {
  LOW: { label: 'Low', color: 'var(--muted-foreground)', hint: 'Whenever you get a chance' },
  MEDIUM: { label: 'Medium', color: accentColor('operations'), hint: 'Normal everyday issue' },
  HIGH: { label: 'High', color: accentColor('attendance'), hint: 'Blocking part of your work' },
  URGENT: { label: 'Urgent', color: 'var(--destructive)', hint: 'Gym operations are stopped' },
};

export const STATUS_ORDER: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const PRIORITY_ORDER: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
