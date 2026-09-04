export interface BodyMeasurementDto {
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

export interface CreateBodyMeasurementInput {
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

export type UpdateBodyMeasurementInput = Partial<CreateBodyMeasurementInput>;

/** One row per member who has at least one measurement entry — backs the "Body Measurements" list page, which deliberately shows only members with real history rather than the full member roster (there's no reusable template/catalog to browse otherwise). */
export interface MeasuredMemberDto {
  member: {
    id: string;
    name: string;
    memberId: string;
    profilePhotoUrl: string | null;
    branch: { id: string; name: string };
    trainer: { id: string; name: string } | null;
  };
  latest: BodyMeasurementDto;
  count: number;
}
