import { z } from 'zod';

/**
 * `actorType` picks which credential plane to search — staff sign in with a
 * work email, members with their Member ID — mirroring the two existing
 * login endpoints. `identifier` is deliberately loose (the real login
 * endpoints stay the authority on format); lowercasing is handled in the
 * service per plane.
 */
export const discoverGymsSchema = z.object({
  actorType: z.enum(['staff', 'member']),
  identifier: z.string().trim().min(1, 'Required').max(255),
  password: z.string().min(1, 'Password is required').max(256),
});

export type DiscoverGymsInput = z.infer<typeof discoverGymsSchema>;

export type Actor = DiscoverGymsInput['actorType'];

const otpPhone = z.string().trim().min(7).max(20);

/** One identifier for both audiences: an email is staff, anything else a Member ID (same "@" rule as login). */
export const crossGymForgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Required').max(255),
});

export const crossGymPhoneRequestSchema = z.object({
  actorType: z.enum(['staff', 'member']),
  phone: otpPhone,
});

export const crossGymPhoneVerifySchema = z.object({
  actorType: z.enum(['staff', 'member']),
  phone: otpPhone,
  code: z.string().length(6).regex(/^\d+$/, 'Digits only'),
});
