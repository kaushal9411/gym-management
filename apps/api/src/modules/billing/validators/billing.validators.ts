import { z } from 'zod';

export const billingAddressSchema = z.object({
  legalName: z.string().trim().max(160).optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).toUpperCase(),
  taxId: z.string().trim().max(40).optional(),
});
