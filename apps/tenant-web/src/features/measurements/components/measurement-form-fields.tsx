'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BodyMeasurement, BodyMeasurementFormValues, CreateBodyMeasurementPayload } from '../types';

export const EMPTY_MEASUREMENT_FORM: BodyMeasurementFormValues = {
  recordedAt: new Date().toISOString().slice(0, 10),
  weightKg: '',
  heightCm: '',
  bodyFatPercent: '',
  chestCm: '',
  waistCm: '',
  hipsCm: '',
  bicepsCm: '',
  thighsCm: '',
  notes: '',
};

export function measurementToFormValues(entry: BodyMeasurement): BodyMeasurementFormValues {
  return {
    recordedAt: entry.recordedAt.slice(0, 10),
    weightKg: entry.weightKg ?? '',
    heightCm: entry.heightCm ?? '',
    bodyFatPercent: entry.bodyFatPercent ?? '',
    chestCm: entry.chestCm ?? '',
    waistCm: entry.waistCm ?? '',
    hipsCm: entry.hipsCm ?? '',
    bicepsCm: entry.bicepsCm ?? '',
    thighsCm: entry.thighsCm ?? '',
    notes: entry.notes ?? '',
  };
}

export function measurementFormToPayload(values: BodyMeasurementFormValues): CreateBodyMeasurementPayload {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  return {
    recordedAt: values.recordedAt ? new Date(values.recordedAt).toISOString() : undefined,
    weightKg: num(values.weightKg),
    heightCm: num(values.heightCm),
    bodyFatPercent: num(values.bodyFatPercent),
    chestCm: num(values.chestCm),
    waistCm: num(values.waistCm),
    hipsCm: num(values.hipsCm),
    bicepsCm: num(values.bicepsCm),
    thighsCm: num(values.thighsCm),
    notes: values.notes.trim() || undefined,
  };
}

const FIELDS: Array<{ key: keyof BodyMeasurementFormValues; label: string; suffix: string }> = [
  { key: 'weightKg', label: 'Weight', suffix: 'kg' },
  { key: 'heightCm', label: 'Height', suffix: 'cm' },
  { key: 'bodyFatPercent', label: 'Body fat', suffix: '%' },
  { key: 'chestCm', label: 'Chest', suffix: 'cm' },
  { key: 'waistCm', label: 'Waist', suffix: 'cm' },
  { key: 'hipsCm', label: 'Hips', suffix: 'cm' },
  { key: 'bicepsCm', label: 'Biceps', suffix: 'cm' },
  { key: 'thighsCm', label: 'Thighs', suffix: 'cm' },
];

interface MeasurementFormFieldsProps {
  value: BodyMeasurementFormValues;
  onChange: (value: BodyMeasurementFormValues) => void;
  disabled?: boolean;
}

/** Shared field grid — used by both the inline record/edit form on `MemberMeasurementsCard` and the standalone `/measurements/new` create-and-assign page. */
export function MeasurementFormFields({ value, onChange, disabled }: MeasurementFormFieldsProps) {
  const set = <K extends keyof BodyMeasurementFormValues>(key: K, v: BodyMeasurementFormValues[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="measurementDate" className="text-xs">Date</Label>
          <Input id="measurementDate" type="date" className="h-9" value={value.recordedAt} disabled={disabled} onChange={(e) => set('recordedAt', e.target.value)} />
        </div>
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`measurement-${f.key}`} className="text-xs">
              {f.label} ({f.suffix})
            </Label>
            <Input
              id={`measurement-${f.key}`}
              type="number"
              min={0}
              step="0.1"
              className="h-9"
              value={value[f.key]}
              disabled={disabled}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="measurementNotes" className="text-xs">Notes</Label>
        <Input id="measurementNotes" className="h-9" value={value.notes} disabled={disabled} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </div>
  );
}
