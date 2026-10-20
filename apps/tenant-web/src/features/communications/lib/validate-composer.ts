import { CHANNEL_META, DISABLED_REASON_COPY, MAX_RECIPIENTS } from '../constants';
import type { Channel, DisabledReason } from '../types';
import type { FormField } from './errors';
import { pickedIds, type ComposerState } from './composer';
import { validateMessage, validateSchedule } from './message';

export type ComposerErrors = Partial<Record<Extract<FormField, 'title' | 'body' | 'channels' | 'scheduledAt' | 'audience'>, string>>;

/** Order the first invalid field is focused in. */
export const FIELD_ORDER: Array<keyof ComposerErrors> = ['audience', 'title', 'body', 'channels', 'scheduledAt'];

/** DOM id to focus for each field (see step components). */
export const FIELD_FOCUS_ID: Record<keyof ComposerErrors, string> = {
  audience: 'step-audience',
  title: 'cm-title',
  body: 'cm-body',
  channels: 'step-channels',
  scheduledAt: 'cm-schedule',
};

/**
 * Mirror of the API's create/update rules for the whole form. `unavailable` lists channels the gym cannot send on right now
 * (from the overview / preview) so a stale selection is caught before the round trip.
 */
export function validateComposer(
  s: ComposerState,
  allowedPlaceholders: readonly string[],
  opts: { unavailable?: Partial<Record<Channel, DisabledReason>>; scheduling?: boolean } = {},
): ComposerErrors {
  const m = validateMessage({ title: s.title, body: s.body, channels: s.channels }, allowedPlaceholders);
  const errors: ComposerErrors = { ...m };

  if (!errors.channels) {
    const bad = s.channels.filter((c) => opts.unavailable?.[c]);
    if (bad.length) {
      errors.channels = `${bad.map((c) => CHANNEL_META[c].label).join(', ')}: ${DISABLED_REASON_COPY[opts.unavailable![bad[0]!] as 'disabled_platform' | 'disabled_tenant'].toLowerCase()}. Turn ${bad.length === 1 ? 'it' : 'them'} off to continue.`;
    }
  }

  if (s.mode === 'PICKED') {
    const n = pickedIds(s).length;
    if (n === 0) errors.audience = 'Pick at least one member.';
    else if (n > MAX_RECIPIENTS) errors.audience = `You can pick at most ${MAX_RECIPIENTS.toLocaleString('en-IN')} members.`;
  }

  if (s.scheduleOn && opts.scheduling !== false) {
    const e = validateSchedule(s.scheduledAt);
    if (e) errors.scheduledAt = e;
  }
  return errors;
}

export function firstInvalid(errors: ComposerErrors): keyof ComposerErrors | undefined {
  return FIELD_ORDER.find((f) => errors[f]);
}
