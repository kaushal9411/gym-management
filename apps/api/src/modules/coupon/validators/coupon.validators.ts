import { z } from 'zod';

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  amount: z.coerce.number().positive(),
});
