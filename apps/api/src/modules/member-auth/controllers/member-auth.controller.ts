import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { MemberAuthService } from '../services/member-auth.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

function deviceInfo(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

function serviceFor(req: Request): MemberAuthService {
  return new MemberAuthService(req.tenant!.id);
}

export class MemberAuthController {
  async login(req: TypedBodyRequest<{ memberId: string; password: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).login(req.body.memberId, req.body.password, deviceInfo(req));
    sendSuccess(res, result, 'Login successful');
  }

  async refresh(req: TypedBodyRequest<{ refreshToken: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).refreshTokens(req.body.refreshToken, deviceInfo(req));
    sendSuccess(res, result);
  }

  async logout(req: TypedBodyRequest<{ refreshToken?: string }>, res: Response): Promise<void> {
    if (req.body.refreshToken) await serviceFor(req).logout(req.body.refreshToken);
    sendSuccess(res, null, 'Logged out');
  }

  async lookupActivation(req: Request<{ token: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).lookupVerification(req.params.token, 'ACTIVATION');
    sendSuccess(res, result);
  }

  async acceptActivation(req: TypedBodyRequest<{ token: string; password: string }>, res: Response): Promise<void> {
    await serviceFor(req).acceptActivation(req.body.token, req.body.password);
    sendSuccess(res, null, 'Portal access activated — you can now log in.');
  }

  async forgotPassword(req: TypedBodyRequest<{ memberId: string }>, res: Response): Promise<void> {
    await serviceFor(req).forgotPassword(req.body.memberId);
    sendSuccess(res, null, 'If a portal account exists for that member ID, a reset link has been sent.');
  }

  async lookupPasswordReset(req: Request<{ token: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).lookupVerification(req.params.token, 'PASSWORD_RESET');
    sendSuccess(res, result);
  }

  async resetPassword(req: TypedBodyRequest<{ token: string; password: string }>, res: Response): Promise<void> {
    await serviceFor(req).resetPassword(req.body.token, req.body.password);
    sendSuccess(res, null, 'Password reset — you can now log in.');
  }
}

export const memberAuthController = new MemberAuthController();
