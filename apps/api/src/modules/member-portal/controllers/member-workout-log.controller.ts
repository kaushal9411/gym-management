import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import {
  MemberWorkoutLogService,
  type WorkoutCompleteInput,
  type WorkoutLogInput,
  type WorkoutLogUpdateInput,
} from '../services/member-workout-log.service';

const serviceFor = (req: Request) => new MemberWorkoutLogService(req.tenant!.id);
const memberId = (req: Request) => req.memberAuth!.sub;
const ctxOf = (req: Request) => ({ ipAddress: req.ip, userAgent: req.get('user-agent') });

/** Member-plane workout log - the member id is always `req.memberAuth.sub`, never a param. */
export class MemberWorkoutLogController {
  async history(req: Request, res: Response): Promise<void> {
    const { days } = req.query as unknown as { days: number };
    sendSuccess(res, await serviceFor(req).history(memberId(req), days));
  }

  /** 201 when a new entry was created, 200 when the day's entry was updated. */
  async log(req: Request, res: Response): Promise<void> {
    const result = await serviceFor(req).log(memberId(req), req.body as WorkoutLogInput, ctxOf(req));
    sendSuccess(res, result, result.created ? 'Workout logged.' : 'Workout entry updated.', result.created ? 201 : 200);
  }

  async update(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).update(memberId(req), req.params.id, req.body as WorkoutLogUpdateInput, ctxOf(req));
    sendSuccess(res, result, 'Workout entry updated.');
  }

  async remove(req: Request<{ id: string }>, res: Response): Promise<void> {
    const workout = await serviceFor(req).remove(memberId(req), req.params.id, ctxOf(req));
    sendSuccess(res, { workout }, 'Workout entry removed.');
  }

  async complete(req: Request, res: Response): Promise<void> {
    const result = await serviceFor(req).completeDay(memberId(req), req.body as WorkoutCompleteInput, ctxOf(req));
    sendSuccess(res, result, 'Workout completed.');
  }

  async resetDay(req: Request<{ date: string }>, res: Response): Promise<void> {
    const workout = await serviceFor(req).resetDay(memberId(req), req.params.date, ctxOf(req));
    sendSuccess(res, { workout }, 'Day cleared.');
  }
}

export const memberWorkoutLogController = new MemberWorkoutLogController();
