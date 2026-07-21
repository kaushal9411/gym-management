import type { Paginated, UserStatus } from '@/features/iam/types';

export type StaffRole = 'MANAGER' | 'TRAINER' | 'RECEPTIONIST';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type SalaryType = 'MONTHLY' | 'HOURLY' | 'DAILY' | 'PER_SESSION';
export type WorkStatus = 'WORKING' | 'ON_LEAVE' | 'NOTICE_PERIOD' | 'TERMINATED';

export interface StaffBranchSummary {
  branchId: string;
  branchName: string;
  isPrimary: boolean;
}

export interface StaffListItem {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  role: StaffRole;
  branches: StaffBranchSummary[];
  primaryBranch: StaffBranchSummary | null;
  employmentType: EmploymentType;
  workStatus: WorkStatus;
  joiningDate: string;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface StaffDetail extends StaffListItem {
  gender: Gender | null;
  dateOfBirth: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  notes: string | null;
  salaryType: SalaryType;
  salaryAmount: string | null;
  shift: string | null;
  weeklyOff: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  updatedAt: string;
}

export interface ListStaffParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  role?: StaffRole;
  workStatus?: WorkStatus;
  employmentType?: EmploymentType;
  branchId?: string;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'employeeId' | 'joiningDate' | 'createdAt' | 'lastLoginAt';
  sortDir?: 'asc' | 'desc';
}

export interface CreateStaffPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeId?: string;
  role: StaffRole;
  primaryBranchId: string;
  branchIds?: string[];
  gender?: Gender;
  dateOfBirth?: string;
  joiningDate?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  notes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  employmentType?: EmploymentType;
  salaryType?: SalaryType;
  salaryAmount?: number;
  shift?: string;
  weeklyOff?: string;
  workStatus?: WorkStatus;
}

export interface UpdateStaffPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  avatarUrl?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  joiningDate?: string;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  employmentType?: EmploymentType;
  salaryType?: SalaryType;
  salaryAmount?: number | null;
  shift?: string | null;
  weeklyOff?: string | null;
  workStatus?: WorkStatus;
}

export interface AssignBranchesPayload {
  primaryBranchId: string;
  branchIds: string[];
}

export interface AssignRolePayload {
  role: StaffRole;
}

export interface BulkStaffActionResult {
  succeeded: string[];
  failed: Array<{ userId: string; reason: string }>;
}

export interface StaffBulkImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  primaryBranchName?: string;
  employeeId?: string;
}

export interface StaffBulkImportResult {
  created: number;
  failed: Array<{ row: number; email: string; reason: string }>;
}

export type { Paginated, UserStatus };
