import { z } from 'zod';

export const updatePlatformNotificationCredentialSchema = z.object({
  smtpHost: z.string().trim().max(255).optional(),
  smtpPort: z.coerce.number().int().positive().max(65_535).optional(),
  smtpUser: z.string().trim().max(255).optional(),
  smtpPassword: z.string().max(500).optional(),
  smtpFromName: z.string().trim().max(120).optional(),
  // Allows '' through (the service's clear-field sentinel) alongside a real email — plain `.email()` would reject '' outright.
  smtpFromAddress: z.union([z.literal(''), z.string().trim().email().max(255)]).optional(),
  twilioAccountSid: z.string().trim().max(100).optional(),
  twilioAuthToken: z.string().max(500).optional(),
  twilioSmsFromNumber: z.string().trim().max(30).optional(),
  twilioWhatsappFromNumber: z.string().trim().max(30).optional(),
});
