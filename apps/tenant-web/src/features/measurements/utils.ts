import type { BodyMeasurement } from './types';

/** Compact one-line summary of whichever fields were actually recorded on this entry. */
export function summarizeMeasurement(entry: BodyMeasurement): string {
  const parts: string[] = [];
  if (entry.weightKg) parts.push(`${entry.weightKg} kg`);
  if (entry.heightCm) parts.push(`${entry.heightCm} cm`);
  if (entry.bodyFatPercent) parts.push(`${entry.bodyFatPercent}% fat`);
  if (entry.chestCm) parts.push(`Chest ${entry.chestCm}`);
  if (entry.waistCm) parts.push(`Waist ${entry.waistCm}`);
  if (entry.hipsCm) parts.push(`Hips ${entry.hipsCm}`);
  if (entry.bicepsCm) parts.push(`Biceps ${entry.bicepsCm}`);
  if (entry.thighsCm) parts.push(`Thighs ${entry.thighsCm}`);
  return parts.length > 0 ? parts.join(' · ') : 'No values recorded';
}
