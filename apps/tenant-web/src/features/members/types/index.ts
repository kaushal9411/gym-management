import type { Paginated } from '@/features/iam/types';

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'FROZEN';
export type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUPERSEDED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type BloodGroup =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE'
  | 'UNKNOWN';
export type MemberDocumentType = 'IDENTITY_PROOF' | 'ADDRESS_PROOF' | 'MEDICAL_CERTIFICATE' | 'CONSENT_FORM' | 'OTHER';

export interface BranchSummary {
  id: string;
  name: string;
}

export interface TrainerSummary {
  id: string;
  name: string;
}

export interface CurrentMembershipSummary {
  id: string;
  planId: string;
  planName: string;
  startDate: string;
  endDate: string;
  status: MembershipStatus;
  autoRenew: boolean;
}

export interface MemberListItem {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  name: string;
  profilePhotoUrl: string | null;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  status: MemberStatus;
  branch: BranchSummary;
  trainer: TrainerSummary | null;
  currentMembership: CurrentMembershipSummary | null;
  joiningDate: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface MembershipHistoryEntry {
  id: string;
  planId: string;
  planName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  priceAtAssignment: string;
  status: MembershipStatus;
  autoRenew: boolean;
  createdAt: string;
}

export interface MembershipFreezeEntry {
  id: string;
  membershipId: string | null;
  reason: string | null;
  frozenAt: string;
  unfrozenAt: string | null;
}

export interface MemberDetail extends MemberListItem {
  dateOfBirth: string | null;
  bloodGroup: BloodGroup | null;
  height: string | null;
  weight: string | null;
  occupation: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  medicalConditions: string | null;
  allergies: string | null;
  fitnessGoals: string | null;
  notes: string | null;
  qrCodeToken: string;
  qrCodeImageUrl: string | null;
  canCheckIn: boolean;
  membershipHistory: MembershipHistoryEntry[];
  freezeHistory: MembershipFreezeEntry[];
  updatedAt: string;
}

export interface MemberDocument {
  id: string;
  type: MemberDocumentType;
  fileName: string;
  fileDataUrl: string;
  uploadedAt: string;
}

export interface ListMembersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: MemberStatus;
  branchId?: string;
  trainerId?: string;
  membershipStatus?: MembershipStatus;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'memberId' | 'joiningDate' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface CreateMemberPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  memberId?: string;
  gender?: Gender;
  dateOfBirth?: string;
  bloodGroup?: BloodGroup;
  height?: number;
  weight?: number;
  occupation?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  medicalConditions?: string;
  allergies?: string;
  fitnessGoals?: string;
  joiningDate?: string;
  branchId: string;
  trainerId?: string;
  notes?: string;
}

export interface UpdateMemberPayload {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  memberId?: string;
  profilePhotoUrl?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  bloodGroup?: BloodGroup | null;
  height?: number | null;
  weight?: number | null;
  occupation?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  medicalConditions?: string | null;
  allergies?: string | null;
  fitnessGoals?: string | null;
  notes?: string | null;
}

export interface AssignMembershipPayload {
  planId: string;
  startDate?: string;
  autoRenew?: boolean;
}

export interface RenewMembershipPayload {
  planId?: string;
  autoRenew?: boolean;
}

export interface UpgradeMembershipPayload {
  planId: string;
}

export interface DowngradeMembershipPayload {
  planId: string;
}

export interface ExtendMembershipPayload {
  days: number;
  reason?: string;
}

export interface CancelMembershipPayload {
  reason?: string;
}

export interface BulkMemberActionResult {
  succeeded: string[];
  failed: Array<{ memberId: string; reason: string }>;
}

export interface MemberBulkImportRow {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  memberId?: string;
  branchName?: string;
  trainerEmail?: string;
  planName?: string;
}

export interface MemberBulkImportResult {
  created: number;
  failed: Array<{ row: number; name: string; reason: string }>;
}

// ── Membership Plans (Prompt 15) ──────────────────────────────────────────

export type DurationType = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

export interface MembershipPlan {
  id: string;
  name: string;
  planCode: string;
  description: string | null;
  category: string | null;
  durationValue: number;
  durationType: DurationType;
  durationDays: number;
  price: string;
  joiningFee: string;
  taxPercentage: string;
  discountPercentage: string;
  isActive: boolean;
  displayOrder: number;
  notes: string | null;
  gymAccessAllBranches: boolean;
  accessBranchIds: string[] | null;
  ptSessionsIncluded: number;
  groupClassesIncluded: number;
  dietConsultationIncluded: boolean;
  lockerAccess: boolean;
  guestPasses: number;
  freezeAllowed: boolean;
  freezeDaysLimit: number | null;
  validityStart: string | null;
  validityEnd: string | null;
  gracePeriodDays: number;
  renewalWindowDays: number;
  autoRenewalAllowed: boolean;
  minAge: number | null;
  maxAge: number | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListMembershipPlansParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'planCode' | 'price' | 'displayOrder' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface MembershipPlanFeatureFields {
  gymAccessAllBranches?: boolean;
  accessBranchIds?: string[];
  ptSessionsIncluded?: number;
  groupClassesIncluded?: number;
  dietConsultationIncluded?: boolean;
  lockerAccess?: boolean;
  guestPasses?: number;
  freezeAllowed?: boolean;
  freezeDaysLimit?: number | null;
}

export interface MembershipPlanRuleFields {
  validityStart?: string | null;
  validityEnd?: string | null;
  gracePeriodDays?: number;
  renewalWindowDays?: number;
  autoRenewalAllowed?: boolean;
  minAge?: number | null;
  maxAge?: number | null;
}

export interface CreateMembershipPlanPayload extends MembershipPlanFeatureFields, MembershipPlanRuleFields {
  name: string;
  planCode?: string;
  description?: string;
  category?: string;
  durationValue: number;
  durationType: DurationType;
  price: number;
  joiningFee?: number;
  taxPercentage?: number;
  discountPercentage?: number;
  isActive?: boolean;
  displayOrder?: number;
  notes?: string;
}

export interface UpdateMembershipPlanPayload extends MembershipPlanFeatureFields, MembershipPlanRuleFields {
  name?: string;
  planCode?: string;
  description?: string | null;
  category?: string | null;
  durationValue?: number;
  durationType?: DurationType;
  price?: number;
  joiningFee?: number;
  taxPercentage?: number;
  discountPercentage?: number;
  isActive?: boolean;
  displayOrder?: number;
  notes?: string | null;
}

export type { Paginated };
