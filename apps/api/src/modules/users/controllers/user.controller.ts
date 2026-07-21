import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { BulkImportRow, CreateUserInput, ListUsersQuery, UpdateUserInput } from '../dto/user.dto';
import { UserService } from '../services/user.service';

export class UserController {
  async list(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    sendSuccess(res, await service.list(req.query as unknown as ListUsersQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    sendSuccess(res, await service.getById(req.params.userId!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    const user = await service.create(req.body as CreateUserInput, actorFrom(req));
    sendSuccess(res, user, 'User created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    const user = await service.update(req.params.userId!, req.body as UpdateUserInput, actorFrom(req));
    sendSuccess(res, user, 'User updated.');
  }

  async suspend(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    await service.suspend(req.params.userId!, actorFrom(req));
    sendSuccess(res, null, 'User suspended.');
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    await service.deactivate(req.params.userId!, actorFrom(req));
    sendSuccess(res, null, 'User deactivated.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    await service.restore(req.params.userId!, actorFrom(req));
    sendSuccess(res, null, 'User restored.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    await service.softDelete(req.params.userId!, actorFrom(req));
    sendSuccess(res, null, 'User deleted.');
  }

  async setRoles(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    const { roleIds } = req.body as { roleIds: string[] };
    sendSuccess(res, await service.setRoles(req.params.userId!, roleIds, actorFrom(req)), 'Roles updated.');
  }

  async setBranches(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    const { allBranches, branches } = req.body as {
      allBranches: boolean;
      branches: Array<{ branchId: string; isPrimary?: boolean; expiresAt?: string }>;
    };
    sendSuccess(
      res,
      await service.setBranches(req.params.userId!, allBranches, branches, actorFrom(req)),
      'Branch access updated.',
    );
  }

  async setPermissionOverrides(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    const { overrides } = req.body as { overrides: Array<{ key: string; mode: 'GRANT' | 'DENY' }> };
    sendSuccess(
      res,
      await service.setPermissionOverrides(req.params.userId!, overrides, actorFrom(req)),
      'Permission overrides updated.',
    );
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    const csv = await service.exportCsv();
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="staff-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  async bulkImport(req: Request, res: Response): Promise<void> {
    const service = new UserService(req.tenant!.id);
    const { rows } = req.body as { rows: BulkImportRow[] };
    const result = await service.bulkImport(rows, actorFrom(req));
    sendSuccess(res, result, `${result.created} user(s) imported.`, result.failed.length > 0 ? 207 : 201);
  }
}

export const userController = new UserController();
