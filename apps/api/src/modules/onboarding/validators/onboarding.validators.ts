import { z } from 'zod';

import { emailSchema, passwordSchema } from '../../authentication/validators/auth.validators';
import { SLUG_PATTERN } from '../../tenants/types/tenant.types';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid mobile number');

export const registerOnboardingSchema = z
  .object({
    gymName: z.string().trim().min(2).max(120),
    legalName: z.string().trim().max(160).optional(),
    ownerFirstName: z.string().trim().min(1).max(60),
    ownerLastName: z.string().trim().min(1).max(60),
    email: emailSchema,
    mobile: phoneSchema,
    country: z.string().trim().min(2).max(60),
    state: z.string().trim().min(1).max(60),
    city: z.string().trim().min(1).max(60),
    timezone: z.string().trim().min(1).max(64),
    currency: z.string().trim().length(3).toUpperCase(),
    gstNumber: z.string().trim().max(30).optional(),
    businessRegistrationNumber: z.string().trim().max(40).optional(),
    numberOfBranches: z.coerce.number().int().positive().max(1000).optional(),
    expectedMembers: z.coerce.number().int().positive().max(1_000_000).optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, 'You must accept the Terms of Service'),
    acceptPrivacyPolicy: z.boolean().refine((v) => v, 'You must accept the Privacy Policy'),
    captchaToken: z.string().min(1, 'Captcha verification is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const checkSubdomainSchema = z.object({
  slug: z.string().trim().min(1).max(60),
});

export const sendOtpSchema = z.object({
  sessionId: z.string().uuid(),
});

export const verifyOtpSchema = z.object({
  sessionId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d+$/, 'Digits only'),
});

export const selectPlanSchema = z.object({
  sessionId: z.string().uuid(),
  planSlug: z.string().trim().min(1).max(40),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

export const paymentSchema = z.object({
  sessionId: z.string().uuid(),
  provider: z.enum(['stripe', 'razorpay', 'paypal']),
  paymentToken: z.string().min(1),
});

export const createTenantSchema = z.object({
  sessionId: z.string().uuid(),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(SLUG_PATTERN, 'Lowercase letters, numbers and hyphens only'),
});

export const onboardingStatusSchema = z.object({
  sessionId: z.string().uuid(),
});
