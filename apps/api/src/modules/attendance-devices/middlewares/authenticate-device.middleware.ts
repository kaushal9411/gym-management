import type { NextFunction, Request, Response } from 'express';

import { UnauthenticatedError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { hashToken } from '../../../core/security/token.util';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AttendanceDeviceRepository } from '../repositories/attendance-device.repository';

/**
 * Authenticates a physical attendance reader (or the local bridge agent
 * polling one) by its `X-Device-Key` header, in place of a user JWT —
 * devices can't do an interactive login. Mounted on a normal tenant-scoped
 * route (not a `PLATFORM_ROUTE_PREFIXES` entry, see `app.ts`), so
 * `req.tenant` is already resolved the same way it is for every other call:
 * the device/bridge is configured with the gym's own subdomain URL, same as
 * the mobile app or tenant-web. That keeps the key lookup scoped to one
 * tenant rather than the cross-tenant scan the gateway webhook needs (a
 * payment gateway has no notion of our subdomains; a gym's own hardware does).
 */
export async function authenticateDeviceMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.headers['x-device-key'];
    if (!req.tenant || typeof key !== 'string' || !key) {
      throw new UnauthenticatedError(ErrorCode.UNAUTHENTICATED, 'A device API key is required.');
    }

    const db = getTenantScopedClient(req.tenant.id);
    const devices = new AttendanceDeviceRepository(db);
    const device = await devices.findByApiKeyHash(req.tenant.id, hashToken(key));
    if (!device || !device.isActive) {
      throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'Invalid or disabled device API key.');
    }

    await devices.touchLastSeen(device.id);
    req.attendanceDevice = device;
    next();
  } catch (error) {
    next(error);
  }
}
