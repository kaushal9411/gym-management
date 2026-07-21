import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { PermissionRepository } from '../repositories/permission.repository';

/** "members:read" → "members" — drives the grouped registry/tree UI. */
function resourceOf(key: string): string {
  return key.split(':')[0] ?? key;
}

export class PermissionController {
  /** Full registry, grouped by resource for the permission tree. */
  async list(req: Request, res: Response): Promise<void> {
    const repository = new PermissionRepository(getTenantScopedClient(req.tenant!.id));
    const permissions = await repository.listAll();

    const groups = new Map<string, Array<{ id: string; key: string; description: string | null }>>();
    for (const permission of permissions) {
      const resource = resourceOf(permission.key);
      if (!groups.has(resource)) groups.set(resource, []);
      groups.get(resource)!.push({ id: permission.id, key: permission.key, description: permission.description });
    }

    sendSuccess(res, {
      total: permissions.length,
      groups: [...groups.entries()].map(([resource, perms]) => ({ resource, permissions: perms })),
    });
  }

  /** Roles × permissions matrix — one payload the frontend renders directly. */
  async matrix(req: Request, res: Response): Promise<void> {
    const repository = new PermissionRepository(getTenantScopedClient(req.tenant!.id));
    const [permissions, roles] = await Promise.all([
      repository.listAll(),
      repository.listRolesWithPermissionKeys(req.tenant!.id),
    ]);

    sendSuccess(res, {
      permissions: permissions.map((p) => ({ key: p.key, description: p.description, resource: resourceOf(p.key) })),
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        permissionKeys: role.rolePermissions.map((rp) => rp.permission.key),
      })),
    });
  }
}

export const permissionController = new PermissionController();
