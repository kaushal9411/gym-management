import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from '../dto/branch.dto';
import { BranchService } from '../services/branch.service';

function serviceFor(req: Request): BranchService {
  return new BranchService(req.tenant!.id);
}

export class BranchController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListBranchesQuery));
  }

  /** Unfiltered active-branch list — backs the portal's branch selector and every `BranchSelect` dropdown. Same response shape this endpoint has always had. */
  async listAssignable(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listAssignable());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.branchId!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const branch = await serviceFor(req).create(req.body as CreateBranchInput, actorFrom(req));
    sendSuccess(res, branch, 'Branch created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const branch = await serviceFor(req).update(req.params.branchId!, req.body as UpdateBranchInput, actorFrom(req));
    sendSuccess(res, branch, 'Branch updated.');
  }

  async activate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).activate(req.params.branchId!, actorFrom(req));
    sendSuccess(res, null, 'Branch activated.');
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).deactivate(req.params.branchId!, actorFrom(req));
    sendSuccess(res, null, 'Branch deactivated.');
  }

  async setDefault(req: Request, res: Response): Promise<void> {
    const branch = await serviceFor(req).setDefault(req.params.branchId!, actorFrom(req));
    sendSuccess(res, branch, 'Default branch updated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.branchId!, actorFrom(req));
    sendSuccess(res, null, 'Branch deleted.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    const branch = await serviceFor(req).restore(req.params.branchId!, actorFrom(req));
    sendSuccess(res, branch, 'Branch restored.');
  }
}

export const branchController = new BranchController();
