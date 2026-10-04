import type { MemberProfilePatch, MemberSelfProfile } from '../../services/member-profile.service';

/** Flat string form state keyed by the PATCH key names (`''` = empty). */
export const FORM_KEYS = [
  'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'maritalStatus', 'anniversary',
  'addressLine', 'city', 'state', 'country', 'postalCode',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
  'goal', 'bodyType', 'foodPreference', 'fitnessGoals', 'occupation', 'bloodGroup', 'height', 'weight',
] as const;
export type FormKey = (typeof FORM_KEYS)[number];
export type FormState = Record<FormKey, string>;
export type FormErrors = Partial<Record<FormKey | 'currentPassword', string>>;

export function toFormState(p: MemberSelfProfile): FormState {
  return {
    firstName: p.firstName, lastName: p.lastName, email: p.email ?? '', phone: p.phone ?? '',
    dateOfBirth: p.dateOfBirth ?? '', gender: p.gender ?? '', maritalStatus: p.maritalStatus ?? '', anniversary: p.anniversary ?? '',
    addressLine: p.address.addressLine ?? '', city: p.address.city ?? '', state: p.address.state ?? '', country: p.address.country ?? '', postalCode: p.address.postalCode ?? '',
    emergencyContactName: p.emergencyContact.name ?? '', emergencyContactPhone: p.emergencyContact.phone ?? '', emergencyContactRelation: p.emergencyContact.relation ?? '',
    goal: p.goal ?? '', bodyType: p.bodyType ?? '', foodPreference: p.foodPreference ?? '', fitnessGoals: p.fitnessGoals ?? '',
    occupation: p.occupation ?? '', bloodGroup: p.bloodGroup ?? '',
    height: p.height === null ? '' : String(p.height), weight: p.weight === null ? '' : String(p.weight),
  };
}

const norm = (k: FormKey, v: string) => (k === 'email' ? v.trim().toLowerCase() : v.trim());

export function changedKeys(base: FormState, draft: Partial<FormState>): FormKey[] {
  return FORM_KEYS.filter((k) => draft[k] !== undefined && norm(k, draft[k]!) !== norm(k, base[k]));
}

export function emailChanged(base: FormState, values: FormState): boolean {
  return norm('email', values.email) !== norm('email', base.email);
}

/** Only changed keys; numbers for height/weight; `''` clears. */
export function buildPatch(keys: FormKey[], values: FormState): MemberProfilePatch {
  const patch: MemberProfilePatch = {};
  for (const k of keys) {
    const v = values[k].trim();
    patch[k] = (k === 'height' || k === 'weight') && v !== '' ? Number(v) : k === 'email' ? v.toLowerCase() : v;
  }
  return patch;
}

const PHONE = /^\+?[0-9\s-]{7,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

/** Mirrors `memberProfileUpdateSchema` in apps/api (no stricter). Only validates the given keys. */
export function validate(keys: FormKey[], v: FormState): FormErrors {
  const e: FormErrors = {};
  for (const k of keys) {
    const s = v[k].trim();
    const max = (n: number, msg: string) => { if (s.length > n) e[k] = msg; };
    switch (k) {
      case 'firstName': if (!s) e[k] = 'First name is required'; else max(80, 'First name is too long'); break;
      case 'lastName': if (!s) e[k] = 'Last name is required'; else max(80, 'Last name is too long'); break;
      case 'email': if (s && !EMAIL.test(s)) e[k] = 'Enter a valid email address'; else max(254, 'Email is too long'); break;
      case 'phone': case 'emergencyContactPhone': if (s && !PHONE.test(s)) e[k] = 'Enter a valid phone number (7-15 digits)'; break;
      case 'dateOfBirth': if (s && (!DATE.test(s) || s < '1900-01-01')) e[k] = 'Enter a valid date'; else if (s > today()) e[k] = 'Date of birth cannot be in the future'; break;
      case 'anniversary': if (s && (!DATE.test(s) || s < '1900-01-01')) e[k] = 'Enter a valid date'; break;
      case 'addressLine': max(200, 'Address is too long'); break;
      case 'city': case 'state': case 'country': max(100, 'Too long (max 100 characters)'); break;
      case 'postalCode': max(20, 'Postal code is too long'); break;
      case 'emergencyContactName': max(120, 'Name is too long'); break;
      case 'emergencyContactRelation': max(60, 'Relation is too long'); break;
      case 'occupation': max(120, 'Occupation is too long'); break;
      case 'fitnessGoals': max(1000, 'Please keep this under 1000 characters'); break;
      case 'height': if (s && (!Number.isFinite(Number(s)) || Number(s) < 50 || Number(s) > 300)) e[k] = 'Enter height in cm (50-300)'; break;
      case 'weight': if (s && (!Number.isFinite(Number(s)) || Number(s) < 10 || Number(s) > 500)) e[k] = 'Enter weight in kg (10-500)'; break;
      default: break;
    }
  }
  return e;
}

/** Profile completeness from REAL DTO fields only. */
export function completeness(p: MemberSelfProfile): { pct: number; missing: string[] } {
  const checks: Array<[string, boolean]> = [
    ['photo', !!p.profilePhotoUrl],
    ['phone', !!p.phone],
    ['email', !!p.email],
    ['date of birth', !!p.dateOfBirth],
    ['gender', !!p.gender],
    ['address', !!(p.address.addressLine && p.address.city)],
    ['emergency contact', !!(p.emergencyContact.name && p.emergencyContact.phone)],
    ['fitness goal', !!p.goal],
    ['height & weight', p.height !== null && p.weight !== null],
    ['blood group', !!p.bloodGroup],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([n]) => n) };
}
