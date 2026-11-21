import { z } from 'zod';

export const RAZORPAY_KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{6,}$/;

/** Blank form fields arrive as `''` — treat them as "not provided" so the stored secret is kept. */
const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const keyIdSchema = z
  .string({ required_error: 'Key ID is required' })
  .trim()
  .regex(RAZORPAY_KEY_ID_PATTERN, 'Key ID must look like rzp_test_xxxxxx or rzp_live_xxxxxx');

const keySecretSchema = z.preprocess(blankToUndefined, z.string().trim().min(10, 'Key secret must be at least 10 characters').max(200).optional());

const webhookSecretSchema = z.preprocess(blankToUndefined, z.string().trim().min(8, 'Webhook secret must be at least 8 characters').max(200).optional());

export const upsertRazorpayGatewaySchema = z.object({
  keyId: keyIdSchema,
  keySecret: keySecretSchema,
  webhookSecret: webhookSecretSchema,
  isEnabled: z.boolean().optional(),
});

export const testRazorpayGatewaySchema = z.object({
  keyId: z.preprocess(blankToUndefined, keyIdSchema.optional()),
  keySecret: keySecretSchema,
});

export type UpsertRazorpayGatewayInput = z.infer<typeof upsertRazorpayGatewaySchema>;
export type TestRazorpayGatewayInput = z.infer<typeof testRazorpayGatewaySchema>;
