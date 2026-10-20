import axios from 'axios';

import { AuthServiceError } from '@/features/auth/types';
import { CHANNEL_META } from '../constants';
import type { Channel } from '../types';

export type CommsErrorKind =
  | 'validation'
  | 'audience-empty'
  | 'recipient-limit'
  | 'confirmation'
  | 'channel-disabled'
  | 'quota'
  | 'rate-limit'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'network'
  | 'server'
  | 'cancelled'
  | 'unknown';

export type FormField = 'name' | 'title' | 'body' | 'channels' | 'scheduledAt' | 'audience' | 'holdQuietHours' | 'confirmLargeSend' | 'offsets' | 'enabled';

export interface ShortChannel {
  channel: Channel;
  remaining: number;
  wouldUse: number;
  shortBy: number;
}

export interface CommsError {
  kind: CommsErrorKind;
  /** Human sentence, ready for a banner or toast. */
  message: string;
  status?: number;
  apiCode?: string;
  /** Per-field messages mapped from the API's 422 `errors[]`. */
  fieldErrors: Partial<Record<FormField, string>>;
  /** Messages from `errors[]` that could not be tied to a field. */
  extra: string[];
  shortChannels?: ShortChannel[];
  disabledChannels?: Array<{ channel: Channel; reason: string }>;
  confirm?: { recipientCount: number; threshold: number };
  retryAfterSeconds?: number;
}

const FIELD_MAP: Record<string, FormField> = {
  name: 'name',
  title: 'title',
  body: 'body',
  channels: 'channels',
  scheduledAt: 'scheduledAt',
  sendMode: 'scheduledAt',
  audienceMode: 'audience',
  audienceFilter: 'audience',
  pickedMemberIds: 'audience',
  holdQuietHours: 'holdQuietHours',
  confirmLargeSend: 'confirmLargeSend',
  offsets: 'offsets',
  enabled: 'enabled',
};

function fieldOf(path: string | undefined): FormField | undefined {
  if (!path) return undefined;
  return FIELD_MAP[path.split(/[.[]/)[0]!];
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

function channelName(c: Channel): string {
  return CHANNEL_META[c]?.label ?? c;
}

export function formatWait(seconds?: number): string {
  if (!seconds) return 'a little later';
  if (seconds < 90) return `${Math.ceil(seconds)} seconds`;
  const m = Math.ceil(seconds / 60);
  return m >= 90 ? `${Math.ceil(m / 60)} hours` : `${m} minutes`;
}

/** Turns anything a communications service call can throw into a structured, UI-ready error. */
export function classifyError(error: unknown): CommsError {
  const base: CommsError = { kind: 'unknown', message: 'Something went wrong. Please try again.', fieldErrors: {}, extra: [] };

  if (axios.isCancel(error) || (error instanceof Error && error.name === 'CanceledError')) {
    return { ...base, kind: 'cancelled', message: 'Request cancelled.' };
  }
  if (!(error instanceof AuthServiceError)) return error instanceof Error ? { ...base, message: error.message } : base;

  const d = error.details;
  if (!d) {
    // No HTTP response at all: connection lost / timeout.
    return { ...base, kind: 'network', message: "Can't reach the server. Check your internet connection and try again. Nothing was sent." };
  }

  const out: CommsError = { ...base, message: error.message, status: d.status, apiCode: d.apiCode, retryAfterSeconds: d.retryAfterSeconds };
  const data = asObject(d.data);

  for (const e of d.errors) {
    const f = fieldOf(e.field);
    if (f) out.fieldErrors[f] ??= e.message;
    else if (e.field) out.extra.push(`${e.field}: ${e.message}`);
  }

  if (d.status === 429 || d.apiCode === 'RATE_LIMITED') {
    const wait = formatWait(d.retryAfterSeconds);
    const looksSpecific = /campaigns per hour|try again/i.test(error.message);
    out.kind = 'rate-limit';
    out.message = looksSpecific ? error.message : `You're doing that too often. Please wait ${wait} and try again.`;
    return out;
  }
  if (d.status === 403) {
    out.kind = 'forbidden';
    out.message = "You don't have permission to do that. Ask your gym owner for the Send notifications permission.";
    return out;
  }
  if (d.status === 404) {
    out.kind = 'not-found';
    out.message = d.apiCode === 'NOT_FOUND' && !/route/i.test(error.message) ? error.message : 'That item no longer exists. It may have been removed.';
    return out;
  }

  switch (d.apiCode) {
    case 'AUDIENCE_EMPTY':
      out.kind = 'audience-empty';
      out.message = 'Nobody matches this audience right now. Change the filters or pick members.';
      out.fieldErrors.audience ??= out.message;
      return out;
    case 'RECIPIENT_LIMIT_EXCEEDED':
      out.kind = 'recipient-limit';
      out.message = 'This audience is larger than 5,000 members, which is the most one message can reach. Narrow the filters and send in parts.';
      out.fieldErrors.audience ??= out.message;
      return out;
    case 'CONFIRMATION_REQUIRED': {
      out.kind = 'confirmation';
      const n = Number(data?.recipientCount);
      const t = Number(data?.threshold);
      out.confirm = { recipientCount: Number.isFinite(n) ? n : 0, threshold: Number.isFinite(t) && t > 0 ? t : 100 };
      out.message = `This goes to more than ${out.confirm.threshold} members, so it needs your confirmation.`;
      return out;
    }
    case 'CHANNEL_DISABLED': {
      out.kind = 'channel-disabled';
      const list = Array.isArray(data?.channels) ? (data!.channels as Array<{ channel: Channel; reason: string }>) : [];
      out.disabledChannels = list;
      const names = list.map((c) => channelName(c.channel)).join(', ');
      out.message = names
        ? `${names} ${list.length === 1 ? 'is' : 'are'} not available for your gym right now. Turn ${list.length === 1 ? 'it' : 'them'} off to send.`
        : error.message;
      out.fieldErrors.channels ??= out.message;
      return out;
    }
    case 'QUOTA_EXCEEDED': {
      out.kind = 'quota';
      const list = Array.isArray(data?.shortChannels) ? (data!.shortChannels as ShortChannel[]) : [];
      out.shortChannels = list;
      out.message = list.length
        ? list.map((c) => `${channelName(c.channel)} is short by ${c.shortBy.toLocaleString('en-IN')} (${c.remaining.toLocaleString('en-IN')} left, ${c.wouldUse.toLocaleString('en-IN')} needed)`).join('. ') + '. Turn the channel off or choose fewer members.'
        : error.message;
      out.fieldErrors.channels ??= out.message;
      return out;
    }
    case 'INVALID_STATE':
      out.kind = 'conflict';
      return out;
    default:
      break;
  }

  if (d.status === 409) out.kind = 'conflict';
  else if (d.status === 422 || d.status === 400) {
    out.kind = 'validation';
    if (Object.keys(out.fieldErrors).length === 0 && out.extra.length === 0) out.extra.push(error.message);
    out.message = 'Please fix the highlighted fields and try again.';
  } else if (d.status >= 500) {
    out.kind = 'server';
    out.message = 'Something went wrong on our side. Nothing was lost; please try again in a moment.';
  }
  return out;
}

/** Message for query (read) failures shown in error states with a retry button. */
export function describeLoadError(error: unknown, what: string): string {
  const e = classifyError(error);
  if (e.kind === 'network') return `Can't reach the server, so ${what} could not be loaded.`;
  if (e.kind === 'forbidden') return `You don't have permission to view ${what}.`;
  if (e.kind === 'rate-limit') return e.message;
  return `Could not load ${what}. ${e.kind === 'server' ? 'Please try again in a moment.' : e.message}`;
}

/** True for a 409 INVALID_STATE style state conflict (already sent / already cancelled / not editable). */
export function isStateConflict(e: CommsError): boolean {
  return e.kind === 'conflict';
}
