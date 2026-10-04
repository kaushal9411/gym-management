import axios from 'axios';

import type { BloodGroup, BodyType, FitnessGoal, FoodPreference, Gender, MaritalStatus } from '@/features/members/types';
import { memberApiClient } from './member-api-client';
import { MemberAuthServiceError } from '../types';

/** Self-service profile (`GET`/`PATCH /portal/profile`). Mirrors `MemberProfileDto` in apps/api. Dates are `YYYY-MM-DD`. */
export interface MemberSelfProfile {
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
  address: { addressLine: string | null; city: string | null; state: string | null; country: string | null; postalCode: string | null };
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
  locked: {
    branch: { id: string; name: string } | null;
    trainer: { id: string; name: string } | null;
    status: string;
    joiningDate: string;
    membership: { planName: string; status: string; endDate: string } | null;
  };
  editable: string[];
}

/** Flat PATCH body (values `''` clear an optional field). */
export type MemberProfilePatch = Partial<Record<string, string | number | null>> & { currentPassword?: string };

/** Normalised failure for the profile write endpoints. */
export class ProfileRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly fieldErrors: Record<string, string>,
  ) {
    super(message);
    this.name = 'ProfileRequestError';
  }
}

/**
 * `memberApiClient`'s response interceptor already flattens failures into a
 * `MemberAuthServiceError` whose message is `field: msg; field: msg` for 422s
 * (status/fields are not preserved), so recover the field map from that text.
 */
function fromAuthError(error: MemberAuthServiceError): ProfileRequestError {
  const fieldErrors: Record<string, string> = {};
  for (const part of error.message.split('; ')) {
    const m = /^([A-Za-z]+): (.+)$/.exec(part);
    if (m && !fieldErrors[m[1]!]) fieldErrors[m[1]!] = m[2]!;
  }
  if (Object.keys(fieldErrors).length) return new ProfileRequestError(error.message, 422, fieldErrors);
  const status = error.code === 'RATE_LIMITED' ? 429 : error.code === 'ACCOUNT_LOCKED' ? 423 : null;
  const message = error.code === 'RATE_LIMITED' ? 'Too many changes in a short time. Please wait a few minutes and try again.' : /too large|413|payload/i.test(error.message) ? 'This photo is too large. Try a smaller one.' : error.message;
  return new ProfileRequestError(message, status, {});
}

function toProfileError(error: unknown): ProfileRequestError {
  if (error instanceof ProfileRequestError) return error;
  if (error instanceof MemberAuthServiceError) return fromAuthError(error);
  if (axios.isAxiosError(error)) {
    if (!error.response) return new ProfileRequestError('Network error — check your connection and try again.', null, {});
    const body = error.response.data as { message?: string; errors?: Array<{ field?: string; message: string }> | null } | undefined;
    const fieldErrors: Record<string, string> = {};
    for (const e of body?.errors ?? []) if (e.field && !fieldErrors[e.field]) fieldErrors[e.field] = e.message;
    const status = error.response.status;
    const message =
      status === 413
        ? 'This photo is too large. Try a smaller one.'
        : status === 429
          ? 'Too many changes in a short time. Please wait a few minutes and try again.'
          : (body?.message ?? 'Something went wrong. Please try again.');
    return new ProfileRequestError(message, status, fieldErrors);
  }
  return new ProfileRequestError('Something went wrong. Please try again.', null, {});
}

interface Envelope<T> {
  data: T;
}

export const memberProfileService = {
  async get(): Promise<MemberSelfProfile> {
    try {
      return (await memberApiClient.get<Envelope<MemberSelfProfile>>('/portal/profile')).data.data;
    } catch (e) {
      throw toProfileError(e);
    }
  },
  async update(patch: MemberProfilePatch): Promise<MemberSelfProfile> {
    try {
      return (await memberApiClient.patch<Envelope<MemberSelfProfile>>('/portal/profile', patch)).data.data;
    } catch (e) {
      throw toProfileError(e);
    }
  },
  async uploadPhoto(image: string, onProgress?: (pct: number) => void): Promise<{ profilePhotoUrl: string }> {
    try {
      const res = await memberApiClient.post<Envelope<{ profilePhotoUrl: string }>>(
        '/portal/profile/photo',
        { image },
        { onUploadProgress: (ev) => ev.total && onProgress?.(Math.round((ev.loaded / ev.total) * 100)) },
      );
      return res.data.data;
    } catch (e) {
      throw toProfileError(e);
    }
  },
  async removePhoto(): Promise<void> {
    try {
      await memberApiClient.delete('/portal/profile/photo');
    } catch (e) {
      throw toProfileError(e);
    }
  },
};
