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

export interface CreateRoleInput {
  name: string;
  description?: string;
  priority?: number;
  isDefault?: boolean;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  priority?: number;
  isDefault?: boolean;
  isActive?: boolean;
  permissions?: string[];
}
