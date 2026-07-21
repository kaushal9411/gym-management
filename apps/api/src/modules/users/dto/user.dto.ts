import type { UserStatus } from '@prisma/client';

export interface UserRoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface UserBranchSummary {
  branchId: string;
  branchName: string;
  isPrimary: boolean;
  expiresAt: string | null;
}

export interface UserListItemDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  avatarUrl: string | null;
  roles: UserRoleSummary[];
  allBranches: boolean;
  branches: UserBranchSummary[];
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface UserPermissionOverrideDto {
  key: string;
  mode: 'GRANT' | 'DENY';
}

export interface UserDetailDto extends UserListItemDto {
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  notificationPreferences: Record<string, boolean> | null;
  permissionOverrides: UserPermissionOverrideDto[];
  effectivePermissions: string[];
  emailVerifiedAt: string | null;
  updatedAt: string;
}

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
  roleId?: string;
  branchId?: string;
  createdFrom?: string;
  createdTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
  includeDeleted?: boolean;
  sortBy: 'name' | 'email' | 'createdAt' | 'lastLoginAt';
  sortDir: 'asc' | 'desc';
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  roleIds: string[];
  allBranches?: boolean;
  branches?: Array<{ branchId: string; isPrimary?: boolean; expiresAt?: string }>;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}

export interface BulkImportRow {
  name: string;
  email: string;
  phone?: string;
  roleName?: string;
  password?: string;
}

export interface BulkImportResult {
  created: number;
  failed: Array<{ row: number; email: string; reason: string }>;
}
