import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type {
  AssignWorkoutPlanInput,
  CreateWorkoutPlanInput,
  ListWorkoutPlansQuery,
  MarkProgressInput,
  PlanExerciseInput,
  UpdateMemberWorkoutPlanInput,
  UpdateWorkoutPlanInput,
} from '../dto/workout.dto';
import { WorkoutPlanService } from '../services/workout-plan.service';

function serviceFor(req: Request): WorkoutPlanService {
  return new WorkoutPlanService(req.tenant!.id);
}

export class WorkoutPlanController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListWorkoutPlansQuery));
  }

  async listAssignable(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listAssignable());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).create(req.body as CreateWorkoutPlanInput, actorFrom(req));
    sendSuccess(res, plan, 'Workout plan created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).update(req.params.id!, req.body as UpdateWorkoutPlanInput, actorFrom(req));
    sendSuccess(res, plan, 'Workout plan updated.');
  }

  async setExercises(req: Request, res: Response): Promise<void> {
    const { exercises } = req.body as { exercises: PlanExerciseInput[] };
    const plan = await serviceFor(req).setExercises(req.params.id!, exercises, actorFrom(req));
    sendSuccess(res, plan, 'Weekly schedule updated.');
  }

  async activate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).activate(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Workout plan activated.');
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).deactivate(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Workout plan deactivated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Workout plan deleted.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).restore(req.params.id!, actorFrom(req));
    sendSuccess(res, plan, 'Workout plan restored.');
  }

  async duplicate(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).duplicate(req.params.id!, actorFrom(req));
    sendSuccess(res, plan, 'Workout plan duplicated.', 201);
  }

  async assign(req: Request, res: Response): Promise<void> {
    const assignment = await serviceFor(req).assign(req.params.id!, req.body as AssignWorkoutPlanInput, actorFrom(req));
    sendSuccess(res, assignment, 'Workout plan assigned.', 201);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await serviceFor(req).remove(req.params.assignmentId!, actorFrom(req));
    sendSuccess(res, null, 'Workout plan removed.');
  }

  async updateAssignment(req: Request, res: Response): Promise<void> {
    const assignment = await serviceFor(req).updateAssignment(req.params.assignmentId!, req.body as UpdateMemberWorkoutPlanInput, actorFrom(req));
    sendSuccess(res, assignment, 'Assignment updated.');
  }

  async getMemberWorkoutPlans(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getMemberWorkoutPlans(req.params.memberId!));
  }

  async markProgress(req: Request, res: Response): Promise<void> {
    const assignment = await serviceFor(req).markProgress(req.params.assignmentId!, req.body as MarkProgressInput, actorFrom(req));
    sendSuccess(res, assignment, 'Progress updated.');
  }
}

export const workoutPlanController = new WorkoutPlanController();
