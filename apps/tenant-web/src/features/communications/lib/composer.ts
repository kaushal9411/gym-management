import { fromIso, toLocalInputValue } from './message';
import { CHANNELS } from '../constants';
import type { AudienceFilter, AudienceMode, Campaign, CampaignDetail, CampaignInput, Channel, PreviewRequest, SendMode, TemplateKey } from '../types';

export interface PickedMember {
  id: string;
  memberId: string;
  name: string;
}

/** All UI-local state of the Send message form (never server data; server data stays in TanStack Query). */
export interface ComposerState {
  mode: AudienceMode;
  filter: AudienceFilter;
  /** Insertion-ordered map of hand-picked members. Entries from a saved draft have an empty `name`. */
  picked: Record<string, PickedMember>;
  templateKey: TemplateKey;
  title: string;
  body: string;
  channels: Channel[];
  holdQuietHours: boolean;
  scheduleOn: boolean;
  /** `datetime-local` value in the browser's time zone. */
  scheduledAt: string;
}

export const INITIAL_COMPOSER: ComposerState = {
  mode: 'FILTERS',
  filter: {},
  picked: {},
  templateKey: 'CUSTOM',
  title: '',
  body: '',
  channels: ['PUSH', 'IN_APP'],
  holdQuietHours: true,
  scheduleOn: false,
  scheduledAt: '',
};

/** Drops empty / false / out-of-context keys so the API's strict schema accepts it. */
export function cleanFilter(f: AudienceFilter): AudienceFilter {
  const out: AudienceFilter = {};
  if (f.membershipStatus) out.membershipStatus = f.membershipStatus;
  if (f.membershipStatus === 'EXPIRING') out.expiringWithinDays = f.expiringWithinDays ?? 7;
  if (f.planIds?.length) out.planIds = f.planIds;
  if (f.branchIds?.length) out.branchIds = f.branchIds;
  if (f.trainerIds?.length) out.trainerIds = f.trainerIds;
  if (f.hasTrainer) out.hasTrainer = true;
  if (f.hasOverdueInvoice) out.hasOverdueInvoice = true;
  if (f.hasUnpaidInvoice) out.hasUnpaidInvoice = true;
  if (f.notVisitedDays) out.notVisitedDays = f.notVisitedDays;
  if (f.birthdayThisWeek) out.birthdayThisWeek = true;
  if (f.bookedClassSessionId) out.bookedClassSessionId = f.bookedClassSessionId;
  return out;
}

export function activeFilterCount(f: AudienceFilter): number {
  return Object.keys(cleanFilter(f)).filter((k) => k !== 'expiringWithinDays').length;
}

export function pickedIds(s: ComposerState): string[] {
  return Object.keys(s.picked);
}

/** Preview request, or `null` when there is nothing to count (hand-pick mode with nobody picked). */
export function composerToPreview(s: ComposerState): PreviewRequest | null {
  if (s.mode === 'PICKED') {
    const ids = pickedIds(s);
    return ids.length ? { audienceMode: 'PICKED', pickedMemberIds: ids } : null;
  }
  return { audienceMode: 'FILTERS', audienceFilter: cleanFilter(s.filter) };
}

export function scheduledIso(s: ComposerState): string | undefined {
  if (!s.scheduleOn || !s.scheduledAt) return undefined;
  const d = new Date(s.scheduledAt);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function composerToCampaignInput(s: ComposerState, sendMode: SendMode, confirmLargeSend: boolean): CampaignInput {
  const input: CampaignInput = {
    title: s.title.trim(),
    body: s.body.trim(),
    channels: s.channels,
    audienceMode: s.mode,
    templateKey: s.templateKey,
    sendMode,
    holdQuietHours: s.holdQuietHours,
  };
  if (s.mode === 'PICKED') input.pickedMemberIds = pickedIds(s);
  else input.audienceFilter = cleanFilter(s.filter);
  if (sendMode === 'SCHEDULE') input.scheduledAt = scheduledIso(s);
  if (confirmLargeSend) input.confirmLargeSend = true;
  return input;
}

/** Hydrates the form from a stored DRAFT / SCHEDULED campaign (edit mode). */
export function campaignToComposer(c: CampaignDetail | Campaign, ids?: string[]): ComposerState {
  const picked: Record<string, PickedMember> = {};
  for (const id of ids ?? []) picked[id] = { id, memberId: '', name: '' };
  return {
    mode: c.audienceMode,
    filter: c.audienceFilter ?? {},
    picked,
    templateKey: c.templateKey ?? 'CUSTOM',
    title: c.title,
    body: c.body,
    channels: c.channels,
    holdQuietHours: c.holdQuietHours,
    scheduleOn: c.status === 'SCHEDULED' && !!c.scheduledAt,
    scheduledAt: fromIso(c.scheduledAt),
  };
}

/** Stable string of everything the user can edit — used for dirty tracking. */
export function snapshot(s: ComposerState): string {
  return JSON.stringify({
    m: s.mode,
    f: cleanFilter(s.filter),
    p: pickedIds(s).sort(),
    t: s.templateKey,
    ti: s.title.trim(),
    b: s.body.trim(),
    c: [...s.channels].sort(),
    q: s.holdQuietHours,
    so: s.scheduleOn,
    sa: s.scheduleOn ? s.scheduledAt : '',
  });
}

/** Default schedule suggestion: tomorrow 9:00 local. */
export function defaultScheduleValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInputValue(d);
}

export function channelOrder(channels: Channel[]): Channel[] {
  return CHANNELS.map((c) => c.channel).filter((c) => channels.includes(c));
}

// ── Audience description (history rows, summaries) ─────────────────────
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active members',
  EXPIRING: 'Expiring',
  EXPIRED: 'Expired',
  FROZEN: 'Frozen',
  NO_PLAN: 'No plan',
};

export interface NameLookup {
  plans?: Array<{ id: string; name: string }>;
  branches?: Array<{ id: string; name: string }>;
}

function names(ids: string[], list: Array<{ id: string; name: string }> | undefined, noun: string): string {
  const found = ids.map((id) => list?.find((x) => x.id === id)?.name).filter((n): n is string => !!n);
  if (found.length === ids.length && found.length <= 2) return found.join(' or ');
  return `${ids.length} ${noun}${ids.length === 1 ? '' : 's'}`;
}

export function describeFilter(f: AudienceFilter, ctx: NameLookup = {}): string[] {
  const parts: string[] = [];
  if (f.membershipStatus === 'EXPIRING') parts.push(`Expiring in ${f.expiringWithinDays ?? 7} days`);
  else if (f.membershipStatus) parts.push(STATUS_LABEL[f.membershipStatus] ?? f.membershipStatus);
  if (f.planIds?.length) parts.push(names(f.planIds, ctx.plans, 'plan'));
  if (f.branchIds?.length) parts.push(names(f.branchIds, ctx.branches, 'branch'));
  if (f.trainerIds?.length) parts.push(`${f.trainerIds.length} trainer${f.trainerIds.length === 1 ? '' : 's'}`);
  if (f.hasTrainer) parts.push('Has a trainer');
  if (f.hasOverdueInvoice) parts.push('Overdue invoice');
  if (f.hasUnpaidInvoice) parts.push('Unpaid invoice');
  if (f.notVisitedDays) parts.push(`Not visited in ${f.notVisitedDays} days`);
  if (f.birthdayThisWeek) parts.push('Birthday this week');
  if (f.bookedClassSessionId) parts.push('Booked a class');
  return parts;
}

/** "Expiring in 7 days · 38" style label for a stored campaign. */
export function audienceLabel(c: Campaign, ctx: NameLookup = {}): string {
  if (c.audienceMode === 'PICKED') return `Picked members · ${c.pickedCount.toLocaleString('en-IN')}`;
  const parts = describeFilter(c.audienceFilter ?? {}, ctx);
  const label = parts.length ? parts.join(' + ') : 'All active members';
  // A draft has no resolved audience yet (the API only estimates it when sending starts).
  return c.status === 'DRAFT' ? label : `${label} · ${c.recipientCount.toLocaleString('en-IN')}`;
}
