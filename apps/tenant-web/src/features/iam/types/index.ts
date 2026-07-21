export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'LOCKED' | 'SUSPENDED' | 'DEACTIVATED';

export interface RoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserBranchAccess {
  branchId: string;
  branchName: string;
  isPrimary: boolean;
  expiresAt: string | null;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  avatarUrl: string | null;
  roles: RoleSummary[];
  allBranches: boolean;
  branches: UserBranchAccess[];
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface PermissionOverride {
  key: string;
  mode: 'GRANT' | 'DENY';
}

export interface UserDetail extends UserListItem {
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  notificationPreferences: Record<string, boolean> | null;
  permissionOverrides: PermissionOverride[];
  effectivePermissions: string[];
  emailVerifiedAt: string | null;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  roleId?: string;
  branchId?: string;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastLoginAt';
  sortDir?: 'asc' | 'desc';
}

export interface CreateUserPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  roleIds: string[];
  allBranches?: boolean;
  branches?: Array<{ branchId: string; isPrimary?: boolean; expiresAt?: string }>;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}

export interface PermissionGroup {
  resource: string;
  permissions: Array<{ id: string; key: string; description: string | null }>;
}

export interface PermissionRegistry {
  total: number;
  groups: PermissionGroup[];
}

export interface PermissionMatrix {
  permissions: Array<{ key: string; description: string | null; resource: string }>;
  roles: Array<{ id: string; name: string; isSystem: boolean; permissionKeys: string[] }>;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface InvitationDto {
  id: string;
  email: string;
  role: { id: string; name: string };
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface ProfileDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  emergencyContact: { name: string | null; phone: string | null; relation: string | null };
  notificationPreferences: Record<string, boolean>;
  branchAccess: { allBranches: boolean; branches: UserBranchAccess[] };
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  notificationPreferences?: Record<string, boolean>;
}

export interface ActiveSession {
  id: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface LoginHistoryEntry {
  id: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actor: { id: string; name: string; email: string } | null;
  actorRole: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface BulkImportResult {
  created: number;
  failed: Array<{ row: number; email: string; reason: string }>;
}
