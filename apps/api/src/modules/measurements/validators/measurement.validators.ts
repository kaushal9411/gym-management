import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid() });
export const memberIdParamSchema = z.object({ memberId: z.string().uuid() });

// Generous but sane bounds — reject obvious typos (e.g. "1750" kg) without
// pretending to know every legitimate outlier.
const measurementFields = {
  recordedAt: z.string().trim().min(1).optional(),
  weightKg: z.number().positive().max(500).optional(),
  heightCm: z.number().positive().max(300).optional(),
  bodyFatPercent: z.number().min(0).max(80).optional(),
  chestCm: z.number().positive().max(300).optional(),
  waistCm: z.number().positive().max(300).optional(),
  hipsCm: z.number().positive().max(300).optional(),
  bicepsCm: z.number().positive().max(150).optional(),
  thighsCm: z.number().positive().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
};

export const createBodyMeasurementSchema = z.object(measurementFields);
export const updateBodyMeasurementSchema = z.object(measurementFields).partial();
