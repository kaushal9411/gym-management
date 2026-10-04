'use client';

/** Shared bits for the support pages: status/priority chips and the age helper (all derived from ticket.createdAt). */
import { Chip, type ChipTone } from '@/features/dashboard/components/ui';
import { statusLabel } from '@/features/tenants/components/detail/tabs/_shared/kit';
import type { TicketPriority, TicketStatus } from '../types';

export const STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const PRIORITIES: TicketPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_TONE: Record<TicketStatus, ChipTone> = { OPEN: 'blue', IN_PROGRESS: 'amber', RESOLVED: 'green', CLOSED: 'slate' };
const PRIORITY_TONE: Record<TicketPriority, ChipTone> = { URGENT: 'red', HIGH: 'amber', MEDIUM: 'blue', LOW: 'slate' };
export const PRIORITY_COLOR: Record<TicketPriority, string> = { URGENT: 'var(--chart-5)', HIGH: 'var(--chart-4)', MEDIUM: 'var(--chart-2)', LOW: 'var(--chart-7)' };
export const STATUS_COLOR: Record<TicketStatus, string> = { OPEN: 'var(--chart-2)', IN_PROGRESS: 'var(--chart-4)', RESOLVED: 'var(--chart-6)', CLOSED: 'var(--chart-7)' };

export const TicketStatusChip = ({ status }: { status: TicketStatus }) => <Chip tone={STATUS_TONE[status]}>{statusLabel(status)}</Chip>;
export const TicketPriorityChip = ({ priority }: { priority: TicketPriority }) => <Chip tone={PRIORITY_TONE[priority]}>{statusLabel(priority)}</Chip>;

export const isLive = (s: TicketStatus): boolean => s === 'OPEN' || s === 'IN_PROGRESS';
export const ageDays = (iso: string, now: number | null): number => (now === null ? 0 : Math.max(0, (now - new Date(iso).getTime()) / 86_400_000));

export function fmtAge(days: number): string {
  if (days < 1 / 24) return '<1h';
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${Math.floor(days)}d`;
}

/** Age badge only for tickets still being worked: amber after 3 days, red after 7. */
export function AgeBadge({ iso, status, now }: { iso: string; status: TicketStatus; now: number | null }) {
  if (!isLive(status) || now === null) return <span className="text-muted-foreground">—</span>;
  const d = ageDays(iso, now);
  return <Chip tone={d >= 7 ? 'red' : d >= 3 ? 'amber' : 'green'}>{fmtAge(d)} open</Chip>;
}
