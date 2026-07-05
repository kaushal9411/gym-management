import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { BranchRepository } from '../repositories/branch.repository';

export class BranchController {
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const repository = new BranchRepository(getTenantScopedClient(tenantId));
    const branches = await repository.list(tenantId);
    sendSuccess(res, branches);
  }
}

export const branchController = new BranchController();
