import { ValidationError } from '../../../core/errors/app-error';

/** How far back a member may back-date a self-logged measurement. */
export const MEMBER_MEASUREMENT_BACKDATE_DAYS = 365;

/** Numeric columns a member may log (everything except `recordedAt`/`notes`). */
export const MEMBER_MEASUREMENT_VALUE_KEYS = [
  'weightKg',
  'heightCm',
  'bodyFatPercent',
  'chestCm',
  'waistCm',
  'hipsCm',
  'bicepsCm',
  'thighsCm',
] as const;

export type MemberMeasurementValueKey = (typeof MEMBER_MEASUREMENT_VALUE_KEYS)[number];

export type MemberMeasurementValues = Partial<Record<MemberMeasurementValueKey, number>> & { notes?: string };

const DAY_MS = 86_400_000;

/** True when at least one numeric measurement is present (notes alone do not count). */
export function hasMeasurementValue(input: Partial<Record<MemberMeasurementValueKey, unknown>>): boolean {
  return MEMBER_MEASUREMENT_VALUE_KEYS.some((k) => input[k] !== undefined && input[k] !== null);
}

/** Only the supplied fields (undefined dropped) — the shape written on create/update/merge. */
export function pickMeasurementValues(input: MemberMeasurementValues): MemberMeasurementValues {
  const out: MemberMeasurementValues = {};
  for (const k of MEMBER_MEASUREMENT_VALUE_KEYS) if (input[k] !== undefined) out[k] = input[k];
  if (input.notes !== undefined) out.notes = input.notes;
  return out;
}

/**
 * Calendar day (`YYYY-MM-DD`) a client-supplied `recordedAt` refers to.
 * The mobile app sends UTC midnight of the chosen day (`...T00:00:00.000Z`) or
 * a plain date, so the leading date part IS the day; any other instant falls
 * back to its UTC calendar date. Returns null for unparseable input.
 */
export function dayOfRecordedAt(raw: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toISOString().slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}` ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * Resolves the day for a self-logged entry: defaults to `today` (the member's
 * branch-local date), rejects the future and anything older than
 * {@link MEMBER_MEASUREMENT_BACKDATE_DAYS}. Returns the day string plus the
 * UTC-midnight `Date` that is stored (and unique-indexed) for MEMBER rows.
 */
export function resolveMemberMeasurementDay(raw: string | undefined, today: string): { day: string; date: Date } {
  const day = raw === undefined ? today : dayOfRecordedAt(raw);
  if (!day) throw new ValidationError('Enter a valid date.');
  if (day > today) throw new ValidationError('You can’t log a measurement for a future date.');
  const ageDays = Math.round((dayToDate(today).getTime() - dayToDate(day).getTime()) / DAY_MS);
  if (ageDays > MEMBER_MEASUREMENT_BACKDATE_DAYS) {
    throw new ValidationError(`You can only back-date a measurement up to ${MEMBER_MEASUREMENT_BACKDATE_DAYS} days.`);
  }
  return { day, date: dayToDate(day) };
}
