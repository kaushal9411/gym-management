import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminRoleService } from '../services/admin-role.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

export class AdminRoleController {
  async listPermissions(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminRoleService.listPermissions());
  }

  async listRoles(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminRoleService.listRoles());
  }

  async createRole(req: TypedBodyRequest<{ name: string; description?: string; permissionKeys: string[] }>, res: Response): Promise<void> {
    const role = await adminRoleService.createRole(req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, role, 'Role created.', 201);
  }

  async updateRolePermissions(req: TypedBodyRequest<{ permissionKeys: string[] }>, res: Response): Promise<void> {
    const role = await adminRoleService.updateRolePermissions(req.params.roleId!, req.body.permissionKeys, req.admin!.sub, req.admin!.role);
    sendSuccess(res, role, 'Role permissions updated.');
  }

  async listAdmins(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminRoleService.listAdmins(req.query as unknown as { page: number; limit: number; search?: string }));
  }

  async createAdmin(req: TypedBodyRequest<{ name: string; email: string; roleId: string }>, res: Response): Promise<void> {
    const admin = await adminRoleService.createAdmin(req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, admin, 'Admin user created.', 201);
  }

  async updateAdminRole(req: TypedBodyRequest<{ roleId: string }>, res: Response): Promise<void> {
    const admin = await adminRoleService.updateRole(req.params.adminId!, req.body.roleId, req.admin!.sub, req.admin!.role);
    sendSuccess(res, admin, 'Admin role updated.');
  }

  async setAdminStatus(req: TypedBodyRequest<{ status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' }>, res: Response): Promise<void> {
    const admin = await adminRoleService.setStatus(req.params.adminId!, req.body.status, req.admin!.sub, req.admin!.role);
    sendSuccess(res, admin, 'Admin status updated.');
  }
}

export const adminRoleController = new AdminRoleController();
