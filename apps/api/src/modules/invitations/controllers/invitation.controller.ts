import type { InvitationStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import { InvitationService } from '../services/invitation.service';

export class InvitationController {
  async list(req: Request, res: Response): Promise<void> {
    const service = new InvitationService(req.tenant!.id);
    const query = req.query as unknown as { status?: InvitationStatus; page: number; limit: number };
    sendSuccess(res, await service.list(query));
  }

  async create(req: Request, res: Response): Promise<void> {
    const service = new InvitationService(req.tenant!.id);
    const invitation = await service.invite(
      req.body as { email: string; roleId: string; branchIds?: string[] },
      actorFrom(req),
    );
    sendSuccess(res, invitation, 'Invitation sent.', 201);
  }

  async resend(req: Request, res: Response): Promise<void> {
    const service = new InvitationService(req.tenant!.id);
    sendSuccess(res, await service.resend(req.params.invitationId!, actorFrom(req)), 'Invitation resent.');
  }

  async revoke(req: Request, res: Response): Promise<void> {
    const service = new InvitationService(req.tenant!.id);
    await service.revoke(req.params.invitationId!, actorFrom(req));
    sendSuccess(res, null, 'Invitation revoked.');
  }

  /** Public — invitee's browser resolves the invitation before showing the accept form. */
  async lookup(req: Request, res: Response): Promise<void> {
    const service = new InvitationService(req.tenant!.id);
    const { token } = req.query as { token: string };
    sendSuccess(res, await service.lookup(token));
  }

  /** Public — consumes the invitation and creates the account. */
  async accept(req: Request, res: Response): Promise<void> {
    const service = new InvitationService(req.tenant!.id);
    const result = await service.accept(
      req.body as { token: string; name: string; phone?: string; password: string },
    );
    sendSuccess(res, result, 'Invitation accepted — you can sign in now.', 201);
  }
}

export const invitationController = new InvitationController();
