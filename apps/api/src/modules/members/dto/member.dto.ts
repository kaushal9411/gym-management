import type { BloodGroup, DurationType, Gender, MemberDocumentType, MemberStatus, MembershipStatus } from '@prisma/client';

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

export interface MemberListItemDto {
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

export interface MembershipHistoryEntryDto {
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

export interface MembershipFreezeEntryDto {
  id: string;
  membershipId: string | null;
  reason: string | null;
  frozenAt: string;
  unfrozenAt: string | null;
}

export interface MemberDetailDto extends MemberListItemDto {
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
  /** Informational only — no attendance module exists yet to enforce this. */
  canCheckIn: boolean;
  membershipHistory: MembershipHistoryEntryDto[];
  freezeHistory: MembershipFreezeEntryDto[];
  updatedAt: string;
}

export interface MemberDocumentDto {
  id: string;
  type: MemberDocumentType;
  fileName: string;
  fileDataUrl: string;
  uploadedAt: string;
}

export interface ListMembersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: MemberStatus;
  branchId?: string;
  trainerId?: string;
  membershipStatus?: MembershipStatus;
  includeDeleted?: boolean;
  sortBy: 'name' | 'memberId' | 'joiningDate' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface CreateMemberInput {
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

export interface UpdateMemberInput {
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

export interface AssignMembershipInput {
  planId: string;
  startDate?: string;
  autoRenew?: boolean;
}

export interface RenewMembershipInput {
  planId?: string;
  autoRenew?: boolean;
}

export interface UpgradeMembershipInput {
  planId: string;
}

export interface DowngradeMembershipInput {
  planId: string;
}

export interface ExtendMembershipInput {
  days: number;
  reason?: string;
}

export interface CancelMembershipInput {
  reason?: string;
}

export interface FreezeMembershipInput {
  reason?: string;
}

export interface TransferBranchInput {
  branchId: string;
}

export interface AssignTrainerInput {
  trainerId: string | null;
}

export interface UploadDocumentInput {
  type: MemberDocumentType;
  fileName: string;
  fileDataUrl: string;
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

export interface MembershipPlanDto {
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

export interface ListMembershipPlansQuery {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy: 'name' | 'planCode' | 'price' | 'displayOrder' | 'createdAt';
  sortDir: 'asc' | 'desc';
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

export interface CreateMembershipPlanInput extends MembershipPlanFeatureFields, MembershipPlanRuleFields {
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

export interface UpdateMembershipPlanInput extends MembershipPlanFeatureFields, MembershipPlanRuleFields {
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
