import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateFoodInput, ListFoodsQuery, UpdateFoodInput } from '../dto/diet.dto';
import { FoodService } from '../services/food.service';

function serviceFor(req: Request): FoodService {
  return new FoodService(req.tenant!.id);
}

export class FoodController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListFoodsQuery));
  }

  async listActive(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listActive());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const food = await serviceFor(req).create(req.body as CreateFoodInput, actorFrom(req));
    sendSuccess(res, food, 'Food created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const food = await serviceFor(req).update(req.params.id!, req.body as UpdateFoodInput, actorFrom(req));
    sendSuccess(res, food, 'Food updated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Food deleted.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    const food = await serviceFor(req).restore(req.params.id!, actorFrom(req));
    sendSuccess(res, food, 'Food restored.');
  }
}

export const foodController = new FoodController();
