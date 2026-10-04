import { z } from 'zod';

export const memberPortalPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const memberWorkoutProgressSchema = z.object({
  exerciseId: z.string().uuid('Invalid exercise id'),
  status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED']),
  notes: z.string().max(500).optional(),
});

export const memberDietLogSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  waterIntakeMl: z.coerce.number().int().nonnegative().optional(),
  weightKg: z.coerce.number().positive().optional(),
  mealsStatus: z.record(z.enum(['PENDING', 'COMPLETED', 'SKIPPED'])).optional(),
  notes: z.string().max(500).optional(),
});

export const memberPortalIdParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export const memberPortalClassesQuerySchema = z.object({
  dateFrom: z.string().min(1, 'dateFrom is required'),
  dateTo: z.string().min(1, 'dateTo is required'),
});

const DEVICE_TOKEN_PLATFORMS = ['ANDROID', 'IOS', 'WEB'] as const;

export const memberRegisterDeviceTokenSchema = z.object({
  token: z.string().trim().min(1).max(255),
  platform: z.enum(DEVICE_TOKEN_PLATFORMS).default('ANDROID'),
});

export const memberUnregisterDeviceTokenSchema = z.object({
  token: z.string().trim().min(1).max(255),
});

const NOTIFICATION_CATEGORIES = [
  'ANNOUNCEMENT',
  'SYSTEM',
  'SUBSCRIPTION',
  'GENERAL',
  'MEMBER',
  'MEMBERSHIP',
  'PAYMENT',
  'ATTENDANCE',
  'WORKOUT',
  'DIET',
  'STAFF',
] as const;

export const memberNotificationsQuerySchema = z.object({
  // `z.coerce.boolean()` would turn the string "false" into true — parse the literal instead.
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const memberRenewalPaymentParamSchema = z.object({
  paymentId: z.string().uuid('Invalid payment id'),
});

export const memberVerifyRenewalCheckoutSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

/** Shared by `/invoices/:id/pay/checkout/:paymentId/verify` — `id` is the invoice, `paymentId` the `MemberPayment` row created by the checkout step. */
export const memberInvoicePaymentParamSchema = z.object({
  id: z.string().uuid('Invalid invoice id'),
  paymentId: z.string().uuid('Invalid payment id'),
});

/** Same shape as `memberVerifyRenewalCheckoutSchema` — kept as a separate export (not a re-used alias) so the two call sites can diverge later without a shared-schema footgun. */
export const memberVerifyInvoicePaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

// ── Self-service profile (PATCH /portal/profile) ─────────────────────────
// Dedicated `.strict()` whitelist — NEVER the staff `updateMemberSchema`.
// `""` clears an optional field (→ null); first/last name can't be blank.

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);
const optionalField = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(blankToNull, schema.nullable().optional());

const profilePhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number (7-15 digits)');

const profileDate = z
  .string()
  .date('Enter a valid date (YYYY-MM-DD)')
  .refine((d) => d >= '1900-01-01', 'Enter a valid date');

export const memberProfileUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(80, 'First name is too long'),
    lastName: z.string().trim().min(1, 'Last name is required').max(80, 'Last name is too long'),
    email: optionalField(z.string().trim().email('Enter a valid email address').max(254, 'Email is too long').toLowerCase()),
    phone: optionalField(profilePhone),
    dateOfBirth: optionalField(
      profileDate.refine((d) => d <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future'),
    ),
    gender: optionalField(
      z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'], {
        message: 'Choose a valid gender option',
      }),
    ),
    addressLine: optionalField(z.string().trim().max(200, 'Address is too long')),
    city: optionalField(z.string().trim().max(100, 'City is too long')),
    state: optionalField(z.string().trim().max(100, 'State is too long')),
    country: optionalField(z.string().trim().max(100, 'Country is too long')),
    postalCode: optionalField(z.string().trim().max(20, 'Postal code is too long')),
    emergencyContactName: optionalField(z.string().trim().max(120, 'Name is too long')),
    emergencyContactPhone: optionalField(profilePhone),
    emergencyContactRelation: optionalField(z.string().trim().max(60, 'Relation is too long')),
    occupation: optionalField(z.string().trim().max(120, 'Occupation is too long')),
    height: optionalField(z.coerce.number({ message: 'Enter height in cm' }).min(50, 'Enter height in cm').max(300, 'Enter height in cm')),
    weight: optionalField(z.coerce.number({ message: 'Enter weight in kg' }).min(10, 'Enter weight in kg').max(500, 'Enter weight in kg')),
    bloodGroup: optionalField(
      z.enum(
        ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN'],
        { message: 'Choose a valid blood group' },
      ),
    ),
    maritalStatus: optionalField(
      z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'PREFER_NOT_TO_SAY'], {
        message: 'Choose a valid marital status',
      }),
    ),
    anniversary: optionalField(profileDate),
    goal: optionalField(
      z.enum(['WEIGHT_LOSS', 'WEIGHT_GAIN', 'MUSCLE_BUILDING', 'GENERAL_FITNESS', 'ENDURANCE', 'REHABILITATION', 'OTHER'], {
        message: 'Choose a valid fitness goal',
      }),
    ),
    bodyType: optionalField(
      z.enum(['ECTOMORPH', 'MESOMORPH', 'ENDOMORPH', 'AVERAGE', 'UNKNOWN'], {
        message: 'Choose a valid body type',
      }),
    ),
    foodPreference: optionalField(
      z.enum(['VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'UNKNOWN'], {
        message: 'Choose a valid food preference',
      }),
    ),
    fitnessGoals: optionalField(z.string().trim().max(1000, 'Please keep this under 1000 characters')),
    /** Required only when `email` actually changes (checked in the service against the stored value). */
    currentPassword: z.string().min(1).max(200).optional(),
  })
  .partial()
  .strict();

export const memberProfilePhotoSchema = z
  .object({
    /** Base64 data-URL (`data:image/jpeg;base64,...`) — same input style the staff photo flow uses. */
    image: z.string().min(1, 'Choose a photo to upload').max(1_000_000, 'This photo is too large. Choose one under 700 KB (or resize it).'),
  })
  .strict();
