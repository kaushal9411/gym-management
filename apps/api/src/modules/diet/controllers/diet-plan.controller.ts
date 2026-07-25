import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type {
  AssignDietPlanInput,
  CreateDietPlanInput,
  ListDietPlansQuery,
  PlanMealInput,
  UpdateDietPlanInput,
  UpdateDietProgressInput,
  UpdateMemberDietPlanInput,
} from '../dto/diet.dto';
import { DietPlanService } from '../services/diet-plan.service';

function serviceFor(req: Request): DietPlanService {
  return new DietPlanService(req.tenant!.id);
}

export class DietPlanController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListDietPlansQuery));
  }

  async listAssignable(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listAssignable());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).create(req.body as CreateDietPlanInput, actorFrom(req));
    sendSuccess(res, plan, 'Diet plan created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).update(req.params.id!, req.body as UpdateDietPlanInput, actorFrom(req));
    sendSuccess(res, plan, 'Diet plan updated.');
  }

  async setMeals(req: Request, res: Response): Promise<void> {
    const { meals } = req.body as { meals: PlanMealInput[] };
    const plan = await serviceFor(req).setMeals(req.params.id!, meals, actorFrom(req));
    sendSuccess(res, plan, 'Meal builder updated.');
  }

  async activate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).activate(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Diet plan activated.');
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).deactivate(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Diet plan deactivated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Diet plan deleted.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).restore(req.params.id!, actorFrom(req));
    sendSuccess(res, plan, 'Diet plan restored.');
  }

  async duplicate(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).duplicate(req.params.id!, actorFrom(req));
    sendSuccess(res, plan, 'Diet plan duplicated.', 201);
  }

  async assign(req: Request, res: Response): Promise<void> {
    const assignment = await serviceFor(req).assign(req.params.id!, req.body as AssignDietPlanInput, actorFrom(req));
    sendSuccess(res, assignment, 'Diet plan assigned.', 201);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await serviceFor(req).remove(req.params.assignmentId!, actorFrom(req));
    sendSuccess(res, null, 'Diet plan removed.');
  }

  async updateAssignment(req: Request, res: Response): Promise<void> {
    const assignment = await serviceFor(req).updateAssignment(req.params.assignmentId!, req.body as UpdateMemberDietPlanInput, actorFrom(req));
    sendSuccess(res, assignment, 'Assignment updated.');
  }

  async getMemberDietPlans(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getMemberDietPlans(req.params.memberId!));
  }

  async updateProgress(req: Request, res: Response): Promise<void> {
    const assignment = await serviceFor(req).updateProgress(req.params.assignmentId!, req.body as UpdateDietProgressInput, actorFrom(req));
    sendSuccess(res, assignment, 'Progress updated.');
  }
}

export const dietPlanController = new DietPlanController();
