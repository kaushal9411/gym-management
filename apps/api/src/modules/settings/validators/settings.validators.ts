import { z } from 'zod';

/**
 * Lenient CSS color string — the codebase stores brand colors as oklch()
 * today (see prisma seed / tenant provisioning) but a hex/rgb/named value
 * is equally valid CSS, so this only bounds length and blocks characters
 * that have no business in a color value (no `<`, `;`, quotes, etc.).
 */
const cssColorSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-zA-Z0-9#%.,() -]+$/, 'Not a valid color value');

const businessHoursDaySchema = z.object({
  open: z.string().trim().max(10).nullable().optional(),
  close: z.string().trim().max(10).nullable().optional(),
  closed: z.boolean().default(false),
});

const businessHoursSchema = z
  .object({
    monday: businessHoursDaySchema.optional(),
    tuesday: businessHoursDaySchema.optional(),
    wednesday: businessHoursDaySchema.optional(),
    thursday: businessHoursDaySchema.optional(),
    friday: businessHoursDaySchema.optional(),
    saturday: businessHoursDaySchema.optional(),
    sunday: businessHoursDaySchema.optional(),
  })
  .strict();

const urlOrEmptySchema = z.string().trim().url().max(255).optional().or(z.literal('').transform(() => undefined));

const socialLinksSchema = z
  .object({
    facebook: urlOrEmptySchema,
    instagram: urlOrEmptySchema,
    twitter: urlOrEmptySchema,
    youtube: urlOrEmptySchema,
    linkedin: urlOrEmptySchema,
  })
  .strict();

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number');

// ── Gym Profile ─────────────────────────────────────────────────────────

export const updateGymProfileSchema = z
  .object({
    gymName: z.string().trim().min(2).max(120).optional(),
    legalBusinessName: z.string().trim().max(160).nullable().optional(),
    registrationNumber: z.string().trim().max(60).nullable().optional(),
    gstVatNumber: z.string().trim().max(40).nullable().optional(),
    businessType: z.string().trim().max(60).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const updateContactInfoSchema = z
  .object({
    email: z.string().trim().email().max(255).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    alternatePhone: phoneSchema.nullable().optional(),
    website: z.string().trim().url().max(255).nullable().optional(),
    addressLine: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const updateBusinessHoursSchema = businessHoursSchema;

export const updateSocialLinksSchema = socialLinksSchema;

// ── Business Settings ───────────────────────────────────────────────────

export const updateBusinessSettingsSchema = z
  .object({
    currency: z.string().trim().length(3).toUpperCase().optional(),
    currencySymbol: z.string().trim().min(1).max(8).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    weekStartDay: z.coerce.number().int().min(0).max(6).optional(),
    measurementUnit: z.enum(['METRIC', 'IMPERIAL']).optional(),
    locale: z.string().trim().min(2).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

// ── Branding ─────────────────────────────────────────────────────────────

export const updateBrandingSchema = z
  .object({
    primaryColor: cssColorSchema.optional(),
    secondaryColor: cssColorSchema.optional(),
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
    welcomeMessage: z.string().trim().max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

/**
 * Data-URL image upload — no object storage yet (matches the IAM avatar
 * pattern), so the browser downscales client-side and posts a base64
 * data: URL. 400,000 chars (~300KB raw) keeps every upload well under the
 * API's 1MB JSON body limit even with the rest of the request payload.
 */
export const uploadImageSchema = z.object({
  dataUrl: z
    .string()
    .trim()
    .min(1)
    .max(400_000)
    .regex(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/, 'Must be a base64 image data URL'),
});

export const uploadBrandingAssetSchema = z.object({
  field: z.enum(['loginBackgroundUrl', 'dashboardBannerUrl', 'emailLogoUrl']),
  dataUrl: uploadImageSchema.shape.dataUrl,
});

// ── Invoice Settings ─────────────────────────────────────────────────────

export const updateInvoiceSettingsSchema = z
  .object({
    invoicePrefix: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and hyphens only')
      .optional(),
    invoiceFooter: z.string().trim().max(1000).nullable().optional(),
    taxPercentage: z.coerce.number().min(0).max(100).optional(),
    defaultPaymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

// ── Email Settings ───────────────────────────────────────────────────────

export const updateEmailSettingsSchema = z
  .object({
    emailFromName: z.string().trim().max(120).nullable().optional(),
    emailFromAddress: z.string().trim().email().max(255).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

// ── Notification Preferences ─────────────────────────────────────────────

export const updateNotificationSettingsSchema = z
  .object({
    emailNotificationsEnabled: z.boolean().optional(),
    pushNotificationsEnabled: z.boolean().optional(),
    smsNotificationsEnabled: z.boolean().optional(),
    smsProviderConfig: z.record(z.unknown()).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });
