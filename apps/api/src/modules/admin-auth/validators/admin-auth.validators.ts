import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const adminRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const adminLogoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
