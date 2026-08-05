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

export const memberResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
