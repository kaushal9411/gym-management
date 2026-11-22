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

/**
 * `actorType` is optional on the phone endpoints: a phone number cannot say
 * whether it belongs to staff or a member, so the default `'any'` makes the
 * server search BOTH planes. `'staff'` / `'member'` are still accepted (older
 * clients) and restrict the search to that plane.
 */
export const phoneActorSchema = z.enum(['staff', 'member', 'any']).default('any');

export type PhoneActor = z.infer<typeof phoneActorSchema>;

export const crossGymPhoneRequestSchema = z.object({
  actorType: phoneActorSchema,
  phone: otpPhone,
});

export const crossGymPhoneVerifySchema = z.object({
  actorType: phoneActorSchema,
  phone: otpPhone,
  code: z.string().length(6).regex(/^\d+$/, 'Digits only'),
});
