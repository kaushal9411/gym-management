import { BODY_MAX, MAX_SCHEDULE_DAYS, MIN_SCHEDULE_LEAD_MS, SMS_TEXT_MAX, TITLE_MAX } from '../constants';
import type { Channel } from '../types';

/** Client-side mirror of the API's placeholder / message / schedule rules (`modules/communications/utils/placeholder.util.ts`, validators). */

const TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Sample values for the live preview (same set the API uses for test-sends). */
export const PREVIEW_VARS: Record<string, string> = {
  firstName: 'Aarav',
  lastName: 'Kapoor',
  memberCode: 'MEM-0001',
  planName: 'Monthly',
  endDate: '26 Oct 2026',
  amountDue: '₹1,500',
  gymName: 'your gym',
  daysLeft: '3',
  daysAway: '14',
  invoiceNumber: 'INV-0042',
  dueDate: '22 Oct 2026',
  className: 'Evening HIIT',
  classDate: '23 Oct 2026',
  classTime: '6:30 pm',
};

export function renderPreview(text: string, vars: Record<string, string> = PREVIEW_VARS): string {
  return text.replace(TOKEN, (whole, name: string) => vars[name] ?? whole);
}

/** Human-readable placeholder problems (empty = OK); unknown names are named, stray braces flagged. */
export function placeholderIssues(text: string, allowed: readonly string[]): string[] {
  const unknown = new Set<string>();
  for (const m of text.matchAll(TOKEN)) if (!allowed.includes(m[1]!)) unknown.add(m[1]!);
  const issues = [...unknown].map((n) => `Unknown placeholder {{${n}}}. Use only: ${allowed.map((p) => `{{${p}}}`).join(' ')}`);
  const leftover = text.replace(TOKEN, '');
  if (leftover.includes('{{') || leftover.includes('}}')) issues.push('Every "{{" or "}}" must be part of a complete {{name}} placeholder.');
  return issues;
}

// ── SMS length (GSM 03.38 vs Unicode), mirrors apps/api sms-segments.util ──
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€\f';

export interface SmsEstimate {
  characters: number;
  segments: number;
  unicode: boolean;
}

export function estimateSms(text: string): SmsEstimate {
  let septets = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) septets += 1;
    else if (GSM_EXTENDED.includes(ch)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) return { characters: septets, segments: septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153), unicode: false };
  const units = text.length;
  return { characters: units, segments: units <= 70 ? 1 : Math.ceil(units / 67), unicode: true };
}

export interface MessageFields {
  title: string;
  body: string;
  channels: Channel[];
}

export interface MessageErrors {
  title?: string;
  body?: string;
  channels?: string;
}

/** Same rules as the API's createCampaign schema (title/body required and bounded, placeholders, ≥1 channel, SMS cap). */
export function validateMessage(f: MessageFields, allowed: readonly string[]): MessageErrors {
  const errors: MessageErrors = {};
  const title = f.title.trim();
  const body = f.body.trim();
  if (!title) errors.title = 'Add a title.';
  else if (title.length > TITLE_MAX) errors.title = `Title can be at most ${TITLE_MAX} characters (it is ${title.length}).`;
  else errors.title = placeholderIssues(title, allowed)[0];

  if (!body) errors.body = 'Write the message.';
  else if (body.length > BODY_MAX) errors.body = `Message can be at most ${BODY_MAX} characters (it is ${body.length}).`;
  else errors.body = placeholderIssues(body, allowed)[0];

  if (f.channels.length === 0) errors.channels = 'Choose at least one channel.';

  if (!errors.body && !errors.title && f.channels.includes('SMS')) {
    const sample = renderPreview(`${title}\n${body}`);
    if (sample.length > SMS_TEXT_MAX) {
      errors.body = `For SMS the title and message together can be at most ${SMS_TEXT_MAX} characters (yours is about ${sample.length}). Shorten it or turn SMS off.`;
    }
  }
  if (!errors.title) delete errors.title;
  if (!errors.body) delete errors.body;
  return errors;
}

/** Schedule window: at least a minute ahead, at most 90 days. `value` is a `datetime-local` string (browser-local time). */
export function validateSchedule(value: string, now = Date.now()): string | undefined {
  if (!value) return 'Pick a date and time to send.';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return 'That date and time is not valid.';
  if (t < now + MIN_SCHEDULE_LEAD_MS) return 'Pick a time at least a minute from now.';
  if (t > now + MAX_SCHEDULE_DAYS * 86_400_000) return `You can schedule at most ${MAX_SCHEDULE_DAYS} days ahead.`;
  return undefined;
}

/** `datetime-local` value (local wall time) for a Date. */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromIso(iso: string | null): string {
  return iso ? toLocalInputValue(new Date(iso)) : '';
}

export function localTimezoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'your local time';
  }
}
