import type { EmploymentType, Gender, SalaryType, UserStatus, WorkStatus } from '@prisma/client';

/** The only roles this module manages — the Owner already exists via the OWNER system role. */
export const STAFF_ROLE_NAMES = ['MANAGER', 'TRAINER', 'RECEPTIONIST'] as const;
export type StaffRoleName = (typeof STAFF_ROLE_NAMES)[number];

export interface StaffBranchSummary {
  branchId: string;
  branchName: string;
  isPrimary: boolean;
}

export interface StaffListItemDto {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  role: StaffRoleName;
  branches: StaffBranchSummary[];
  primaryBranch: StaffBranchSummary | null;
  employmentType: EmploymentType;
  workStatus: WorkStatus;
  joiningDate: string;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface StaffDetailDto extends StaffListItemDto {
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

export interface ListStaffQuery {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
  role?: StaffRoleName;
  workStatus?: WorkStatus;
  employmentType?: EmploymentType;
  branchId?: string;
  includeDeleted?: boolean;
  sortBy: 'name' | 'employeeId' | 'joiningDate' | 'createdAt' | 'lastLoginAt';
  sortDir: 'asc' | 'desc';
}

export interface CreateStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeId?: string;
  role: StaffRoleName;
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

export interface UpdateStaffInput {
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

export interface AssignBranchesInput {
  primaryBranchId: string;
  branchIds: string[];
}

export interface AssignRoleInput {
  role: StaffRoleName;
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
