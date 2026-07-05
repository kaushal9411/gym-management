import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import type { UpsertPlanInput } from '../repositories/admin-plan.repository';
import { adminPlanService } from '../services/admin-plan.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

export class AdminPlanController {
  async list(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminPlanService.list());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminPlanService.getById(req.params.planId!));
  }

  async create(req: TypedBodyRequest<UpsertPlanInput>, res: Response): Promise<void> {
    const plan = await adminPlanService.create(req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, plan, 'Plan created.', 201);
  }

  async update(req: TypedBodyRequest<Partial<UpsertPlanInput>>, res: Response): Promise<void> {
    const plan = await adminPlanService.update(req.params.planId!, req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, plan, 'Plan updated.');
  }

  async setActive(req: TypedBodyRequest<{ isActive: boolean }>, res: Response): Promise<void> {
    const plan = await adminPlanService.setActive(req.params.planId!, req.body.isActive, req.admin!.sub, req.admin!.role);
    sendSuccess(res, plan, req.body.isActive ? 'Plan enabled.' : 'Plan disabled.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminPlanService.remove(req.params.planId!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Plan deleted.');
  }
}

export const adminPlanController = new AdminPlanController();
