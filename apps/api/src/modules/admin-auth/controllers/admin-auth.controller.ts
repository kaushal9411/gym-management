import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminAuthService } from '../services/admin-auth.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

function deviceInfo(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export class AdminAuthController {
  async login(req: TypedBodyRequest<{ email: string; password: string }>, res: Response): Promise<void> {
    const result = await adminAuthService.login(req.body.email, req.body.password, deviceInfo(req));
    sendSuccess(res, result, 'Login successful');
  }

  async refresh(req: TypedBodyRequest<{ refreshToken: string }>, res: Response): Promise<void> {
    const result = await adminAuthService.refreshTokens(req.body.refreshToken, deviceInfo(req));
    sendSuccess(res, result);
  }

  async logout(req: TypedBodyRequest<{ refreshToken?: string }>, res: Response): Promise<void> {
    if (req.body.refreshToken) await adminAuthService.logout(req.body.refreshToken);
    sendSuccess(res, null, 'Logged out');
  }

  async me(req: Request, res: Response): Promise<void> {
    const profile = await adminAuthService.me(req.admin!.sub);
    sendSuccess(res, profile);
  }
}

export const adminAuthController = new AdminAuthController();
