import { z } from 'zod';

export const memberLoginSchema = z.object({
  memberId: z.string().trim().min(1, 'Member ID is required'),
  password: z.string().min(1, 'Password is required'),
});

export const memberRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const memberLogoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const memberActivationTokenParamSchema = z.object({
  token: z.string().min(1),
});

export const memberAcceptActivationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const memberForgotPasswordSchema = z.object({
  memberId: z.string().trim().min(1, 'Member ID is required'),
});

/** Loose — server remains the authority on real validity; this just rejects obvious junk. */
const memberPhoneSchema = z.string().trim().min(7).max(20);

export const memberPhoneLoginRequestSchema = z.object({
  phone: memberPhoneSchema,
});

export const memberPhoneLoginVerifySchema = z.object({
  phone: memberPhoneSchema,
  code: z.string().trim().length(6).regex(/^\d+$/, 'Digits only'),
});

export const memberResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** In-app password change (authenticated) — distinct from the forgot-password/reset-token flow above. */
export const memberChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });
