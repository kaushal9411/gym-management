import { z } from 'zod';

import { emailSchema, phoneSchema, slugSchema, strongPasswordSchema } from '@/features/auth/schemas';

export const OTP_CODE_LENGTH = 6;

export const accountDetailsSchema = z
  .object({
    gymName: z.string().trim().min(2, 'Gym name is required').max(120),
    legalName: z.string().trim().max(160).optional().or(z.literal('')),
    ownerFirstName: z.string().trim().min(1, 'First name is required').max(60),
    ownerLastName: z.string().trim().min(1, 'Last name is required').max(60),
    email: emailSchema,
    mobile: phoneSchema,
    country: z.string().trim().min(2, 'Country is required').max(60),
    state: z.string().trim().min(1, 'State is required').max(60),
    city: z.string().trim().min(1, 'City is required').max(60),
    timezone: z.string().trim().min(1, 'Timezone is required'),
    currency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase(),
    gstNumber: z.string().trim().max(30).optional().or(z.literal('')),
    businessRegistrationNumber: z.string().trim().max(40).optional().or(z.literal('')),
    numberOfBranches: z.coerce.number().int().positive().max(1000).optional(),
    expectedMembers: z.coerce.number().int().positive().max(1_000_000).optional(),
    password: strongPasswordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, 'You must accept the Terms of Service'),
    acceptPrivacyPolicy: z.boolean().refine((v) => v, 'You must accept the Privacy Policy'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type AccountDetailsFormValues = z.infer<typeof accountDetailsSchema>;

export const subdomainFormSchema = z.object({
  subdomain: slugSchema,
});

export type SubdomainFormValues = z.infer<typeof subdomainFormSchema>;

export const onboardingOtpSchema = z.object({
  code: z
    .string()
    .length(OTP_CODE_LENGTH, `Enter the ${OTP_CODE_LENGTH}-digit code`)
    .regex(/^\d+$/, 'Digits only'),
});

export type OnboardingOtpFormValues = z.infer<typeof onboardingOtpSchema>;
