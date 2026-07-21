import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateRoleInput, UpdateRoleInput } from '../dto/role.dto';
import { RoleService } from '../services/role.service';

export class RoleController {
  async list(req: Request, res: Response): Promise<void> {
    const service = new RoleService(req.tenant!.id);
    sendSuccess(res, await service.list());
  }

  async getById(req: Request, res: Response): Promise<void> {
    const service = new RoleService(req.tenant!.id);
    sendSuccess(res, await service.getById(req.params.roleId!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const service = new RoleService(req.tenant!.id);
    const role = await service.create(req.body as CreateRoleInput, actorFrom(req));
    sendSuccess(res, role, 'Role created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const service = new RoleService(req.tenant!.id);
    const role = await service.update(req.params.roleId!, req.body as UpdateRoleInput, actorFrom(req));
    sendSuccess(res, role, 'Role updated.');
  }

  async delete(req: Request, res: Response): Promise<void> {
    const service = new RoleService(req.tenant!.id);
    await service.delete(req.params.roleId!, actorFrom(req));
    sendSuccess(res, null, 'Role deleted.');
  }

  async clone(req: Request, res: Response): Promise<void> {
    const service = new RoleService(req.tenant!.id);
    const { name } = req.body as { name?: string };
    const role = await service.clone(req.params.roleId!, name, actorFrom(req));
    sendSuccess(res, role, 'Role cloned.', 201);
  }
}

export const roleController = new RoleController();
