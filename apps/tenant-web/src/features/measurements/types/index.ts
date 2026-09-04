export interface BodyMeasurement {
  id: string;
  memberId: string;
  recordedAt: string;
  weightKg: string | null;
  heightCm: string | null;
  bodyFatPercent: string | null;
  chestCm: string | null;
  waistCm: string | null;
  hipsCm: string | null;
  bicepsCm: string | null;
  thighsCm: string | null;
  notes: string | null;
  recordedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BodyMeasurementFormValues {
  recordedAt: string;
  weightKg: string;
  heightCm: string;
  bodyFatPercent: string;
  chestCm: string;
  waistCm: string;
  hipsCm: string;
  bicepsCm: string;
  thighsCm: string;
  notes: string;
}

export interface CreateBodyMeasurementPayload {
  recordedAt?: string;
  weightKg?: number;
  heightCm?: number;
  bodyFatPercent?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  bicepsCm?: number;
  thighsCm?: number;
  notes?: string;
}

export type UpdateBodyMeasurementPayload = Partial<CreateBodyMeasurementPayload>;

/** One row per member who has at least one measurement — backs the Body Measurements list page. */
export interface MeasuredMember {
  member: {
    id: string;
    name: string;
    memberId: string;
    profilePhotoUrl: string | null;
    branch: { id: string; name: string };
    trainer: { id: string; name: string } | null;
  };
  latest: BodyMeasurement;
  count: number;
}
