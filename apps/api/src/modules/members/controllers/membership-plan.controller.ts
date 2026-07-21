import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateMembershipPlanInput, ListMembershipPlansQuery, UpdateMembershipPlanInput } from '../dto/member.dto';
import { MembershipPlanService } from '../services/membership-plan.service';

function serviceFor(req: Request): MembershipPlanService {
  return new MembershipPlanService(req.tenant!.id);
}

export class MembershipPlanController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListMembershipPlansQuery));
  }

  /** Unfiltered active-only list — backs Assign/Renew/Upgrade dropdowns. */
  async listAssignable(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listAssignable());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.planId!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).create(req.body as CreateMembershipPlanInput, actorFrom(req));
    sendSuccess(res, plan, 'Membership plan created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).update(req.params.planId!, req.body as UpdateMembershipPlanInput, actorFrom(req));
    sendSuccess(res, plan, 'Membership plan updated.');
  }

  async activate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).activate(req.params.planId!, actorFrom(req));
    sendSuccess(res, null, 'Membership plan activated.');
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).deactivate(req.params.planId!, actorFrom(req));
    sendSuccess(res, null, 'Membership plan deactivated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.planId!, actorFrom(req));
    sendSuccess(res, null, 'Membership plan deleted.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).restore(req.params.planId!, actorFrom(req));
    sendSuccess(res, plan, 'Membership plan restored.');
  }

  async duplicate(req: Request, res: Response): Promise<void> {
    const plan = await serviceFor(req).duplicate(req.params.planId!, actorFrom(req));
    sendSuccess(res, plan, 'Membership plan duplicated.', 201);
  }
}

export const membershipPlanController = new MembershipPlanController();
