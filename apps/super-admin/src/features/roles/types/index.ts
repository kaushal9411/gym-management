export interface AdminPermission {
  id: string;
  key: string;
  description: string | null;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: Array<{ permission: AdminPermission }>;
  _count?: { adminUsers: number };
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateAdminInput {
  name: string;
  email: string;
  roleId: string;
}

export interface CreateAdminResult {
  id: string;
  name: string;
  email: string;
  temporaryPassword: string;
}
