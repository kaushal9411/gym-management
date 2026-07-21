import { z } from 'zod';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number');

const emailSchema = z.string().trim().min(1).email('Enter a valid email address').toLowerCase();

const memberCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, 'Member ID can only contain letters, numbers, and hyphens');

const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
const bloodGroupSchema = z.enum([
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN',
]);
const memberStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'FROZEN']);
const membershipStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUPERSEDED']);
const documentTypeSchema = z.enum(['IDENTITY_PROOF', 'ADDRESS_PROOF', 'MEDICAL_CERTIFICATE', 'CONSENT_FORM', 'OTHER']);

export const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: memberStatusSchema.optional(),
  branchId: z.string().uuid().optional(),
  trainerId: z.string().uuid().optional(),
  membershipStatus: membershipStatusSchema.optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'memberId', 'joiningDate', 'createdAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const createMemberSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  memberId: memberCodeSchema.optional(),
  gender: genderSchema.optional(),
  dateOfBirth: z.string().datetime().optional(),
  bloodGroup: bloodGroupSchema.optional(),
  height: z.coerce.number().min(0).max(300).optional(),
  weight: z.coerce.number().min(0).max(500).optional(),
  occupation: z.string().trim().max(120).optional(),
  addressLine: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: phoneSchema.optional(),
  emergencyContactRelation: z.string().trim().max(60).optional(),
  medicalConditions: z.string().trim().max(2000).optional(),
  allergies: z.string().trim().max(2000).optional(),
  fitnessGoals: z.string().trim().max(2000).optional(),
  joiningDate: z.string().datetime().optional(),
  branchId: z.string().uuid(),
  trainerId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateMemberSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    email: emailSchema.nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    memberId: memberCodeSchema.optional(),
    profilePhotoUrl: z.string().max(400_000).nullable().optional(),
    gender: genderSchema.nullable().optional(),
    dateOfBirth: z.string().datetime().nullable().optional(),
    bloodGroup: bloodGroupSchema.nullable().optional(),
    height: z.coerce.number().min(0).max(300).nullable().optional(),
    weight: z.coerce.number().min(0).max(500).nullable().optional(),
    occupation: z.string().trim().max(120).nullable().optional(),
    addressLine: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    emergencyContactName: z.string().trim().max(120).nullable().optional(),
    emergencyContactPhone: phoneSchema.nullable().optional(),
    emergencyContactRelation: z.string().trim().max(60).nullable().optional(),
    medicalConditions: z.string().trim().max(2000).nullable().optional(),
    allergies: z.string().trim().max(2000).nullable().optional(),
    fitnessGoals: z.string().trim().max(2000).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const assignMembershipSchema = z.object({
  planId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  autoRenew: z.boolean().optional(),
});

export const renewMembershipSchema = z.object({
  planId: z.string().uuid().optional(),
  autoRenew: z.boolean().optional(),
});

export const upgradeMembershipSchema = z.object({
  planId: z.string().uuid(),
});

export const downgradeMembershipSchema = z.object({
  planId: z.string().uuid(),
});

export const extendMembershipSchema = z.object({
  days: z.coerce.number().int().positive().max(3650),
  reason: z.string().trim().max(500).optional(),
});

export const cancelMembershipSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const freezeMembershipSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const transferBranchSchema = z.object({
  branchId: z.string().uuid(),
});

export const assignTrainerSchema = z.object({
  trainerId: z.string().uuid().nullable(),
});

export const uploadMemberDocumentSchema = z.object({
  type: documentTypeSchema,
  fileName: z.string().trim().min(1).max(200),
  fileDataUrl: z
    .string()
    .max(3_000_000)
    .regex(/^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/, 'Must be a base64 data URL'),
});

export const bulkMemberActionSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(500),
});

export const memberBulkImportSchema = z.object({
  rows: z
    .array(
      z.object({
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        email: z.string().trim().max(255).optional(),
        phone: z.string().trim().max(20).optional(),
        memberId: z.string().trim().max(40).optional(),
        branchName: z.string().trim().max(120).optional(),
        trainerEmail: z.string().trim().max(255).optional(),
        planName: z.string().trim().max(120).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const memberParamSchema = z.object({
  id: z.string().uuid(),
});

export const memberDocumentParamSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
});

// ── Membership Plans (Prompt 15) ──────────────────────────────────────────

const durationTypeSchema = z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']);

const planCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, 'Plan code can only contain letters, numbers, and hyphens');

const planFeatureFields = {
  gymAccessAllBranches: z.boolean().optional(),
  accessBranchIds: z.array(z.string().uuid()).max(200).optional(),
  ptSessionsIncluded: z.coerce.number().int().min(0).max(1000).optional(),
  groupClassesIncluded: z.coerce.number().int().min(0).max(1000).optional(),
  dietConsultationIncluded: z.boolean().optional(),
  lockerAccess: z.boolean().optional(),
  guestPasses: z.coerce.number().int().min(0).max(100).optional(),
  freezeAllowed: z.boolean().optional(),
};

export const listMembershipPlansQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'planCode', 'price', 'displayOrder', 'createdAt']).default('displayOrder'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const createMembershipPlanSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    planCode: planCodeSchema.optional(),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(60).optional(),
    durationValue: z.coerce.number().int().positive().max(999),
    durationType: durationTypeSchema,
    price: z.coerce.number().min(0).max(999_999.99),
    joiningFee: z.coerce.number().min(0).max(999_999.99).optional(),
    taxPercentage: z.coerce.number().min(0).max(100).optional(),
    discountPercentage: z.coerce.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    displayOrder: z.coerce.number().int().min(0).max(100_000).optional(),
    notes: z.string().trim().max(2000).optional(),
    freezeDaysLimit: z.coerce.number().int().min(0).max(3650).nullable().optional(),
    validityStart: z.string().datetime().nullable().optional(),
    validityEnd: z.string().datetime().nullable().optional(),
    gracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
    renewalWindowDays: z.coerce.number().int().min(0).max(365).optional(),
    autoRenewalAllowed: z.boolean().optional(),
    minAge: z.coerce.number().int().min(0).max(150).nullable().optional(),
    maxAge: z.coerce.number().int().min(0).max(150).nullable().optional(),
    ...planFeatureFields,
  })
  .refine((data) => data.minAge === undefined || data.maxAge === undefined || data.minAge === null || data.maxAge === null || data.minAge <= data.maxAge, {
    message: 'Minimum age must be less than or equal to maximum age',
    path: ['minAge'],
  });

export const updateMembershipPlanSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    planCode: planCodeSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    durationValue: z.coerce.number().int().positive().max(999).optional(),
    durationType: durationTypeSchema.optional(),
    price: z.coerce.number().min(0).max(999_999.99).optional(),
    joiningFee: z.coerce.number().min(0).max(999_999.99).optional(),
    taxPercentage: z.coerce.number().min(0).max(100).optional(),
    discountPercentage: z.coerce.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    displayOrder: z.coerce.number().int().min(0).max(100_000).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    freezeDaysLimit: z.coerce.number().int().min(0).max(3650).nullable().optional(),
    validityStart: z.string().datetime().nullable().optional(),
    validityEnd: z.string().datetime().nullable().optional(),
    gracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
    renewalWindowDays: z.coerce.number().int().min(0).max(365).optional(),
    autoRenewalAllowed: z.boolean().optional(),
    minAge: z.coerce.number().int().min(0).max(150).nullable().optional(),
    maxAge: z.coerce.number().int().min(0).max(150).nullable().optional(),
    ...planFeatureFields,
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const membershipPlanParamSchema = z.object({
  planId: z.string().uuid(),
});
