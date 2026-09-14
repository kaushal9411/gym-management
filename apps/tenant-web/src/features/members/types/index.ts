import type { Paginated } from '@/features/iam/types';

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'FROZEN';
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUPERSEDED';
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
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'PREFER_NOT_TO_SAY';
export type BodyType = 'ECTOMORPH' | 'MESOMORPH' | 'ENDOMORPH' | 'AVERAGE' | 'UNKNOWN';
export type FoodPreference = 'VEGETARIAN' | 'NON_VEGETARIAN' | 'VEGAN' | 'EGGETARIAN' | 'UNKNOWN';
export type FitnessGoal =
  | 'WEIGHT_LOSS'
  | 'WEIGHT_GAIN'
  | 'MUSCLE_BUILDING'
  | 'GENERAL_FITNESS'
  | 'ENDURANCE'
  | 'REHABILITATION'
  | 'OTHER';
export type AwarenessSource = 'SOCIAL_MEDIA' | 'FRIEND_REFERRAL' | 'WALK_IN' | 'ADVERTISEMENT' | 'ONLINE_SEARCH' | 'OTHER';
export type MemberPortalStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED';

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
  targetWeight: string | null;
  status: MembershipStatus;
  autoRenew: boolean;
  createdAt: string;
}

export interface ReferredByMemberSummary {
  id: string;
  memberId: string;
  name: string;
}

export interface MembershipFreezeEntry {
  id: string;
  membershipId: string | null;
  reason: string | null;
  frozenAt: string;
  unfrozenAt: string | null;
}

export interface PlanUsage {
  guestPassesUsed: number;
  guestPassesIncluded: number;
  ptSessionsUsed: number;
  ptSessionsIncluded: number;
  groupClassesUsed: number;
  groupClassesIncluded: number;
  freezeDaysUsed: number;
  freezeDaysLimit: number | null;
}

export interface GuestVisit {
  id: string;
  guestName: string | null;
  visitedAt: string;
}

export interface PtSessionLog {
  id: string;
  trainer: { id: string; name: string } | null;
  sessionDate: string;
  notes: string | null;
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
  fatherNameOrAadhaar: string | null;
  maritalStatus: MaritalStatus | null;
  anniversary: string | null;
  goal: FitnessGoal | null;
  registrationFee: string | null;
  bodyType: BodyType | null;
  foodPreference: FoodPreference | null;
  healthHeartCondition: boolean | null;
  healthPainDuringActivity: boolean | null;
  healthDizzinessOrBalance: boolean | null;
  healthDiabetesOrBp: boolean | null;
  healthAsthma: boolean | null;
  healthBoneOrJointProblem: boolean | null;
  healthOtherCondition: boolean | null;
  awarenessSource: AwarenessSource | null;
  healthScreeningOtherDetails: string | null;
  referredByMember: ReferredByMemberSummary | null;
  portalStatus: MemberPortalStatus | null;
  canCheckIn: boolean;
  membershipHistory: MembershipHistoryEntry[];
  freezeHistory: MembershipFreezeEntry[];
  planUsage: PlanUsage | null;
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
  fatherNameOrAadhaar?: string;
  maritalStatus?: MaritalStatus;
  anniversary?: string;
  goal?: FitnessGoal;
  registrationFee?: number;
  bodyType?: BodyType;
  foodPreference?: FoodPreference;
  healthHeartCondition?: boolean;
  healthPainDuringActivity?: boolean;
  healthDizzinessOrBalance?: boolean;
  healthDiabetesOrBp?: boolean;
  healthAsthma?: boolean;
  healthBoneOrJointProblem?: boolean;
  healthOtherCondition?: boolean;
  awarenessSource?: AwarenessSource;
  healthScreeningOtherDetails?: string;
  referredByMemberId?: string;
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
  fatherNameOrAadhaar?: string | null;
  maritalStatus?: MaritalStatus | null;
  anniversary?: string | null;
  goal?: FitnessGoal | null;
  registrationFee?: number | null;
  bodyType?: BodyType | null;
  foodPreference?: FoodPreference | null;
  healthHeartCondition?: boolean | null;
  healthPainDuringActivity?: boolean | null;
  healthDizzinessOrBalance?: boolean | null;
  healthDiabetesOrBp?: boolean | null;
  healthAsthma?: boolean | null;
  healthBoneOrJointProblem?: boolean | null;
  healthOtherCondition?: boolean | null;
  awarenessSource?: AwarenessSource | null;
  healthScreeningOtherDetails?: string | null;
  referredByMemberId?: string | null;
}

export interface AssignMembershipPayload {
  planId: string;
  startDate?: string;
  autoRenew?: boolean;
  targetWeight?: number;
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
  branchId?: string;
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

// ── GDPR export (Prompt 46) ─────────────────────────────────────────────

export interface MemberGdprExport {
  exportedAt: string;
  profile: {
    id: string;
    memberId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    gender: Gender | null;
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
    branch: string;
    trainer: string | null;
    status: string;
    joiningDate: string;
    createdAt: string;
  };
  memberships: { planName: string; startDate: string; endDate: string; status: string; priceAtAssignment: string; autoRenew: boolean }[];
  freezes: { reason: string | null; frozenAt: string; unfrozenAt: string | null }[];
  attendance: { checkInTime: string; checkOutTime: string | null; method: string; status: string }[];
  workoutPlans: { planName: string; startDate: string; endDate: string | null; status: string; progressEntries: number }[];
  dietPlans: { planName: string; startDate: string; endDate: string | null; status: string; dailyLogEntries: number }[];
  invoices: { invoiceNumber: string; invoiceDate: string; totalAmount: string; status: string }[];
  payments: { paymentNumber: string; paymentDate: string; finalAmount: string; method: string; status: string }[];
  documents: { type: string; fileName: string; uploadedAt: string }[];
  classBookings: { className: string; sessionDate: string; status: string; bookedAt: string }[];
}

export type { Paginated };
