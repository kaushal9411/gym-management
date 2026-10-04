import type {
  BloodGroup,
  BodyType,
  FitnessGoal,
  FoodPreference,
  Gender,
  MaritalStatus,
  MemberStatus,
} from '@prisma/client';

import type { MemberRow } from '../../members/repositories/member.repository';
import { EDITABLE_PROFILE_FIELDS } from '../utils/member-profile.util';

/** Self-service profile (`GET`/`PATCH /portal/profile`). Dates are `YYYY-MM-DD`; height/weight are numbers (cm/kg). */
export interface MemberProfileDto {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
  phone: string | null;
  profilePhotoUrl: string | null;
  qrCodeImageUrl: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  address: {
    addressLine: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
  };
  emergencyContact: { name: string | null; phone: string | null; relation: string | null };
  occupation: string | null;
  height: number | null;
  weight: number | null;
  bloodGroup: BloodGroup | null;
  maritalStatus: MaritalStatus | null;
  anniversary: string | null;
  goal: FitnessGoal | null;
  bodyType: BodyType | null;
  foodPreference: FoodPreference | null;
  fitnessGoals: string | null;
  /** Staff/gym-managed — read-only here. */
  locked: {
    branch: { id: string; name: string } | null;
    trainer: { id: string; name: string } | null;
    status: MemberStatus;
    joiningDate: string;
    membership: { planName: string; status: string; endDate: string } | null;
  };
  /** Keys accepted by `PATCH /portal/profile` (flat names; `address`/`emergencyContact` above are grouped for display only). */
  editable: string[];
}

const day = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export function toMemberProfileDto(m: MemberRow): MemberProfileDto {
  const membership =
    m.memberships.find((x) => x.status === 'ACTIVE') ??
    m.memberships.find((x) => x.status === 'PENDING') ??
    m.memberships.find((x) => x.status === 'EXPIRED') ??
    null;
  return {
    id: m.id,
    memberId: m.memberId,
    firstName: m.firstName,
    lastName: m.lastName,
    name: `${m.firstName} ${m.lastName}`.trim(),
    email: m.email,
    phone: m.phone,
    profilePhotoUrl: m.profilePhotoUrl,
    qrCodeImageUrl: m.qrCodeImageUrl,
    dateOfBirth: day(m.dateOfBirth),
    gender: m.gender,
    address: {
      addressLine: m.addressLine,
      city: m.city,
      state: m.state,
      country: m.country,
      postalCode: m.postalCode,
    },
    emergencyContact: {
      name: m.emergencyContactName,
      phone: m.emergencyContactPhone,
      relation: m.emergencyContactRelation,
    },
    occupation: m.occupation,
    height: num(m.height),
    weight: num(m.weight),
    bloodGroup: m.bloodGroup,
    maritalStatus: m.maritalStatus,
    anniversary: day(m.anniversary),
    goal: m.goal,
    bodyType: m.bodyType,
    foodPreference: m.foodPreference,
    fitnessGoals: m.fitnessGoals,
    locked: {
      branch: m.branch ? { id: m.branch.id, name: m.branch.name } : null,
      trainer: m.trainer ? { id: m.trainer.id, name: m.trainer.name } : null,
      status: m.status,
      joiningDate: day(m.joiningDate)!,
      membership: membership
        ? {
            planName: membership.plan.name,
            status: membership.status,
            endDate: day(membership.endDate)!,
          }
        : null,
    },
    editable: [...EDITABLE_PROFILE_FIELDS],
  };
}
