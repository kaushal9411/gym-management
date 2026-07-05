import { z } from 'zod';

import { SLUG_PATTERN } from '../../tenants/types/tenant.types';

export const emailSchema = z.string().trim().min(1).max(255).email().toLowerCase();

/** Structural policy only — the common-password + full policy is re-checked in PasswordService. */
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'At least one uppercase letter')
  .regex(/[a-z]/, 'At least one lowercase letter')
  .regex(/[0-9]/, 'At least one number')
  .regex(/[^A-Za-z0-9]/, 'At least one special character');

export const otpCodeSchema = z.string().length(6).regex(/^\d+$/, 'Digits only');

export const registerGymSchema = z.object({
  gymName: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().min(3).max(40).regex(SLUG_PATTERN, 'Lowercase letters, numbers and hyphens only'),
  ownerName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(), // optional — may arrive via httpOnly cookie instead
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  purpose: z.enum(['login', '2fa']).default('login'),
});

export const resendOtpSchema = z.object({
  email: emailSchema,
  purpose: z.enum(['login', '2fa']).default('login'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});
