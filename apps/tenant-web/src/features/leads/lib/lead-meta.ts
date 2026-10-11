import {
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Footprints,
  Globe,
  Handshake,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  Share2,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import type { FollowUpState, LeadActivityType, LeadLostReason, LeadSource, LeadStatus } from '../types';

export const SOURCE_META: Record<LeadSource, { label: string; icon: LucideIcon; color: string }> = {
  WALK_IN: { label: 'Walk-in', icon: Footprints, color: 'var(--chart-1)' },
  PHONE_CALL: { label: 'Phone call', icon: PhoneCall, color: 'var(--chart-3)' },
  WEBSITE: { label: 'Website', icon: Globe, color: 'var(--chart-2)' },
  SOCIAL_MEDIA: { label: 'Social media', icon: Share2, color: 'var(--chart-5)' },
  REFERRAL: { label: 'Referral', icon: Users, color: 'var(--chart-7)' },
  ADVERTISEMENT: { label: 'Advertisement', icon: Megaphone, color: 'var(--chart-4)' },
  OTHER: { label: 'Other', icon: Briefcase, color: 'var(--chart-6)' },
};

export const STATUS_META: Record<LeadStatus, { label: string; color: string; icon: LucideIcon }> = {
  NEW: { label: 'New', color: 'var(--chart-1)', icon: Sparkles },
  CONTACTED: { label: 'Contacted', color: 'var(--chart-3)', icon: PhoneCall },
  VISIT_SCHEDULED: { label: 'Visit scheduled', color: 'var(--chart-2)', icon: CalendarClock },
  TRIAL_DONE: { label: 'Trial done', color: 'var(--chart-5)', icon: CalendarCheck },
  NEGOTIATION: { label: 'Negotiation', color: 'var(--chart-7)', icon: Handshake },
  CONVERTED: { label: 'Converted', color: 'var(--success)', icon: CheckCircle2 },
  LOST: { label: 'Lost', color: 'var(--destructive)', icon: XCircle },
};

export const LOST_REASON_LABEL: Record<LeadLostReason, string> = {
  PRICE_TOO_HIGH: 'Price too high',
  NOT_INTERESTED: 'Not interested',
  JOINED_COMPETITOR: 'Joined a competitor',
  LOCATION_TOO_FAR: 'Location too far',
  TIMING_NOT_RIGHT: 'Timing not right',
  NO_RESPONSE: 'No response',
  OTHER: 'Other',
};

export const ACTIVITY_META: Record<LeadActivityType, { label: string; icon: LucideIcon; system: boolean }> = {
  NOTE: { label: 'Note', icon: MessageSquareText, system: false },
  CALL: { label: 'Call', icon: PhoneCall, system: false },
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, system: false },
  EMAIL: { label: 'Email', icon: Mail, system: false },
  VISIT: { label: 'Visit', icon: Footprints, system: false },
  TRIAL: { label: 'Trial', icon: CalendarCheck, system: false },
  FOLLOW_UP: { label: 'Follow-up', icon: CalendarClock, system: false },
  STATUS_CHANGE: { label: 'Status changed', icon: Sparkles, system: true },
  ASSIGNMENT: { label: 'Assignment', icon: UserCheck, system: true },
  CREATED: { label: 'Lead created', icon: UserPlus, system: true },
  CONVERTED: { label: 'Converted to member', icon: CheckCircle2, system: true },
};

export const FOLLOW_UP_LABEL: Record<FollowUpState, string> = { overdue: 'Overdue', today: 'Due today', upcoming: 'Upcoming', none: 'No follow-up' };

export const sourceLabel = (s: string): string => SOURCE_META[s as LeadSource]?.label ?? s;
export const sourceColor = (s: string): string => SOURCE_META[s as LeadSource]?.color ?? 'var(--chart-6)';
export const lostReasonLabel = (r: string): string => LOST_REASON_LABEL[r as LeadLostReason] ?? r;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase();
}

export function ageDays(createdAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 86_400_000));
}

export function ageLabel(createdAt: string): string {
  const d = ageDays(createdAt);
  if (d === 0) return 'today';
  if (d === 1) return '1 day';
  if (d < 60) return `${d} days`;
  return `${Math.floor(d / 30)} mo`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDay(iso);
}

/** `<input type="datetime-local">` value <-> ISO. */
export function localInputToIso(v: string): string | undefined {
  return v ? new Date(v).toISOString() : undefined;
}
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
export function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}
