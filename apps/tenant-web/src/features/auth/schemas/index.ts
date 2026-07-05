import { z } from 'zod';

import { OTP_LENGTH, PASSWORD_MIN_LENGTH } from '../constants';

// ── Field schemas (reused across forms; will move to @gym-saas/validation) ──

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .toLowerCase();

/** Full password policy: 8+ chars, upper, lower, number, special. */
export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Z]/, 'At least one uppercase letter')
  .regex(/[a-z]/, 'At least one lowercase letter')
  .regex(/[0-9]/, 'At least one number')
  .regex(/[^A-Za-z0-9]/, 'At least one special character');

export const otpSchema = z
  .string()
  .length(OTP_LENGTH, `Enter the ${OTP_LENGTH}-digit code`)
  .regex(/^\d+$/, 'Digits only');

/** Future-ready: loose E.164 — server remains the authority. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number');

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'At least 3 characters')
  .max(40, 'At most 40 characters')
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Lowercase letters, numbers and hyphens only');

// ── Form schemas ────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
});

export const registerGymSchema = z
  .object({
    gymName: z.string().trim().min(2, 'Gym name is required').max(80),
    slug: slugSchema,
    ownerName: z.string().trim().min(2, 'Your name is required').max(80),
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, 'You must accept the terms to continue'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export const otpFormSchema = z.object({
  code: otpSchema,
});

export const resendOtpSchema = z.object({
  email: emailSchema,
});

export const acceptInvitationSchema = z
  .object({
    name: z.string().trim().min(2, 'Your name is required').max(80),
    phone: phoneSchema.optional().or(z.literal('')),
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ── Inferred form types ─────────────────────────────────────────────────
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterGymFormValues = z.infer<typeof registerGymSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type OtpFormValues = z.infer<typeof otpFormSchema>;
export type ResendOtpFormValues = z.infer<typeof resendOtpSchema>;
export type AcceptInvitationFormValues = z.infer<typeof acceptInvitationSchema>;
