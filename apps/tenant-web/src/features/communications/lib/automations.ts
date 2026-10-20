import { AUTOMATION_ANCHOR } from '../constants';
import type { AutomationRule } from '../types';
import { BODY_MAX, TITLE_MAX } from '../constants';
import { placeholderIssues } from './message';

function list(nums: number[]): string {
  if (nums.length <= 1) return nums.join('');
  return `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`;
}

/** Sentence for a rule's timing, from the API's `timing` + current offsets ("7, 3 and 1 days before the end date"). */
export function describeTiming(rule: AutomationRule, offsets: number[] = rule.offsets): string {
  const { unit } = rule.timing;
  const anchor = AUTOMATION_ANCHOR[rule.key];
  const sorted = [...offsets].sort((a, b) => (unit === 'DAYS_BEFORE' || unit === 'HOURS_BEFORE' ? b - a : a - b));
  if (!rule.timing.editable) return rule.description;
  if (sorted.length === 0) return 'Choose when to send';
  const last = sorted[sorted.length - 1] ?? 0;
  const noun = (n: number, u: string) => (sorted.length === 1 && n === 1 ? u : `${u}s`);
  switch (unit) {
    case 'DAYS_BEFORE':
      return `${list(sorted)} ${noun(last, 'day')} before ${anchor ?? 'the event'}`;
    case 'DAYS_AFTER':
      return `${list(sorted)} ${noun(last, 'day')} after ${anchor ?? 'the event'}`;
    case 'HOURS_BEFORE':
      return `${list(sorted)} ${noun(last, 'hour')} before ${anchor ?? 'the event'}`;
    case 'DAYS_SINCE_VISIT':
      return `After ${list(sorted)} ${noun(last, 'day')} without a visit`;
    default:
      return rule.description;
  }
}

export function timingUnitWord(unit: AutomationRule['timing']['unit']): string {
  return unit === 'HOURS_BEFORE' ? 'hours' : 'days';
}

export interface RuleDraft {
  enabled: boolean;
  offsets: number[];
  channels: AutomationRule['channels'];
  /** Prefilled with the effective default (the gym's Notification template when customised); saved as an override only when edited. */
  title: string;
  body: string;
}

export interface RuleErrors {
  offsets?: string;
  channels?: string;
  title?: string;
  body?: string;
}

export function draftFromRule(r: AutomationRule): RuleDraft {
  return { enabled: r.enabled, offsets: r.offsets, channels: r.channels, title: r.title ?? r.defaultTitle, body: r.body ?? r.defaultBody };
}

/** Same checks as the API's `automationIssues` for one rule. */
export function validateRuleDraft(rule: AutomationRule, d: RuleDraft): RuleErrors {
  const e: RuleErrors = {};
  const t = rule.timing;
  if (t.editable) {
    if (d.offsets.length === 0) e.offsets = 'Choose when to send (at least one timing).';
    else if (d.offsets.length > t.maxCount) e.offsets = `At most ${t.maxCount} timing${t.maxCount === 1 ? '' : 's'} for this reminder.`;
    else if (d.offsets.some((n) => !Number.isInteger(n) || n < t.min || n > t.max)) e.offsets = `Timings must be between ${t.min} and ${t.max}.`;
  }
  if (d.channels.length === 0) e.channels = 'Choose at least one channel.';
  const title = d.title.trim();
  const body = d.body.trim();
  if (title.length > TITLE_MAX) e.title = `Title can be at most ${TITLE_MAX} characters (it is ${title.length}).`;
  else if (title) e.title = placeholderIssues(title, rule.allowedPlaceholders)[0];
  if (body.length > BODY_MAX) e.body = `Message can be at most ${BODY_MAX} characters (it is ${body.length}).`;
  else if (body) e.body = placeholderIssues(body, rule.allowedPlaceholders)[0];
  if (!e.title) delete e.title;
  if (!e.body) delete e.body;
  return e;
}

/** What to send as the rule's own text: null while it still equals the default, so the rule keeps following the Notification template. */
export function overrideText(value: string, fallback: string): string | null {
  const t = value.trim();
  return !t || t === fallback.trim() ? null : t;
}

export function draftChanged(rule: AutomationRule, d: RuleDraft): boolean {
  const base = draftFromRule(rule);
  return (
    base.enabled !== d.enabled ||
    base.title.trim() !== d.title.trim() ||
    base.body.trim() !== d.body.trim() ||
    [...base.channels].sort().join() !== [...d.channels].sort().join() ||
    [...base.offsets].sort().join() !== [...d.offsets].sort().join()
  );
}
