import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateExerciseInput, ListExercisesQuery, UpdateExerciseInput } from '../dto/workout.dto';
import { ExerciseService } from '../services/exercise.service';

function serviceFor(req: Request): ExerciseService {
  return new ExerciseService(req.tenant!.id);
}

export class ExerciseController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListExercisesQuery));
  }

  async listActive(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listActive());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const exercise = await serviceFor(req).create(req.body as CreateExerciseInput, actorFrom(req));
    sendSuccess(res, exercise, 'Exercise created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const exercise = await serviceFor(req).update(req.params.id!, req.body as UpdateExerciseInput, actorFrom(req));
    sendSuccess(res, exercise, 'Exercise updated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Exercise deleted.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    const exercise = await serviceFor(req).restore(req.params.id!, actorFrom(req));
    sendSuccess(res, exercise, 'Exercise restored.');
  }
}

export const exerciseController = new ExerciseController();
