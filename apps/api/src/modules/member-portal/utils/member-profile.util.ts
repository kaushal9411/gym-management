import { ValidationError } from '../../../core/errors/app-error';
import { sniffFileType } from '../../../core/storage/file-signature.util';
import { normalizeEmail } from '../../members/utils/member-pii.util';

/**
 * Pure logic for member self-service profile editing. The whitelist below is
 * the ONLY set of columns the member plane may write — `memberProfileUpdateSchema`
 * (.strict()) and `buildProfileUpdate` both derive from it, so a locked column
 * (status, memberId, branch, trainer, biometricId, notes, referral, billing,
 * health-screening/medical answers) can never reach Prisma.
 */

export const EDITABLE_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'dateOfBirth',
  'gender',
  'addressLine',
  'city',
  'state',
  'country',
  'postalCode',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelation',
  'occupation',
  'height',
  'weight',
  'bloodGroup',
  'maritalStatus',
  'anniversary',
  'goal',
  'bodyType',
  'foodPreference',
  'fitnessGoals',
] as const;

export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

/** Fields that can never be blanked (everything else clears on `""`/`null`). */
export const REQUIRED_PROFILE_FIELDS: readonly EditableProfileField[] = ['firstName', 'lastName'];

/** Enum-valued, non-sensitive fields whose old→new transition may be written to the audit record. */
export const AUDITABLE_ENUM_FIELDS: readonly EditableProfileField[] = [
  'goal',
  'bodyType',
  'foodPreference',
  'maritalStatus',
];

const DATE_FIELDS: readonly EditableProfileField[] = ['dateOfBirth', 'anniversary'];
const NUMERIC_FIELDS: readonly EditableProfileField[] = ['height', 'weight'];

export type ProfilePatch = Partial<Record<EditableProfileField, string | number | null>>;

type ExistingRow = Partial<Record<EditableProfileField, unknown>>;

export interface ProfileUpdatePlan {
  /** Prisma `MemberUncheckedUpdateInput`-compatible data — whitelisted columns only, email/phone still plaintext (the repository encrypts + hashes). */
  data: Record<string, unknown>;
  /** Field NAMES whose value actually changed (never values). */
  changedFields: EditableProfileField[];
  /** Old→new for the non-sensitive enum fields only. */
  enumChanges: Record<string, { from: string | null; to: string | null }>;
  emailChanged: boolean;
  phoneChanged: boolean;
}

function comparable(field: EditableProfileField, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (NUMERIC_FIELDS.includes(field)) return String(Number(value));
  if (field === 'email') return normalizeEmail(String(value));
  return String(value);
}

/**
 * Turns an already-validated patch into the DB update + a change summary.
 * Only fields present in the patch AND different from the stored value are
 * written, so re-submitting an unchanged form is a no-op (and re-sending the
 * current email never demands a password).
 */
export function buildProfileUpdate(patch: ProfilePatch, existing: ExistingRow): ProfileUpdatePlan {
  const data: Record<string, unknown> = {};
  const changedFields: EditableProfileField[] = [];
  const enumChanges: ProfileUpdatePlan['enumChanges'] = {};

  for (const field of EDITABLE_PROFILE_FIELDS) {
    if (!(field in patch)) continue;
    const raw = patch[field];
    const next = raw === undefined ? undefined : raw;
    if (next === undefined) continue;
    if (next === null && REQUIRED_PROFILE_FIELDS.includes(field)) {
      throw new ValidationError('Request validation failed', {
        fields: [{ field, message: 'This field cannot be empty' }],
      });
    }
    const before = comparable(field, existing[field]);
    const after = comparable(field, next);
    if (before === after) continue;

    changedFields.push(field);
    if (next === null) data[field] = null;
    else if (DATE_FIELDS.includes(field)) data[field] = new Date(String(next));
    else if (field === 'email') data[field] = normalizeEmail(String(next));
    else data[field] = next;

    if (AUDITABLE_ENUM_FIELDS.includes(field)) enumChanges[field] = { from: before, to: after };
  }

  return {
    data,
    changedFields,
    enumChanges,
    emailChanged: changedFields.includes('email'),
    phoneChanged: changedFields.includes('phone'),
  };
}

/** The email-change guard: an actual change (or clearing) needs the current password. */
export function assertEmailChangeAuthorized(
  plan: Pick<ProfileUpdatePlan, 'emailChanged'>,
  currentPassword: string | undefined,
): void {
  if (plan.emailChanged && !currentPassword) {
    throw new ValidationError('Request validation failed', {
      fields: [
        {
          field: 'currentPassword',
          message: 'Enter your current password to change your email address',
        },
      ],
    });
  }
}

// ── Photo ────────────────────────────────────────────────────────────────

/** Request bodies are capped at 1 MB app-wide (`express.json`), so a base64 data-URL tops out below that. */
export const MAX_PHOTO_DATA_URL_CHARS = 1_000_000;
export const MAX_PHOTO_BYTES = 740_000;
const PHOTO_DATA_URL_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

/**
 * Validates a base64 image data-URL for a member's own profile photo.
 * JPEG/PNG/WebP only, decided from the real magic bytes (the claimed MIME is
 * ignored; SVG/GIF/PDF are rejected). Throws a user-friendly 422.
 */
export function assertMemberPhotoDataUrl(dataUrl: string): void {
  const fail = (message: string): never => {
    throw new ValidationError('Request validation failed', {
      fields: [{ field: 'image', message }],
    });
  };
  if (dataUrl.length > MAX_PHOTO_DATA_URL_CHARS)
    fail('This photo is too large. Choose one under 700 KB (or resize it).');
  const match = PHOTO_DATA_URL_RE.exec(dataUrl);
  if (!match) return fail('Upload a JPEG, PNG or WebP image.');
  const buffer = Buffer.from(match[2]!, 'base64');
  if (buffer.length === 0) return fail('The photo is empty.');
  if (buffer.length > MAX_PHOTO_BYTES)
    fail('This photo is too large. Choose one under 700 KB (or resize it).');
  const type = sniffFileType(buffer);
  if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/webp')
    fail('Only JPEG, PNG or WebP photos are allowed.');
}
