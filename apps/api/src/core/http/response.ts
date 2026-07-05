import type { Response } from 'express';

import { getRequestContext } from '../logging/request-context';

/** Every API response — success or error — shares this envelope. */
export interface ApiResponseBody<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  errors: Array<{ field?: string; code?: string; message: string }> | null;
  timestamp: string;
  requestId: string;
}

export function sendSuccess<T>(res: Response, data: T, message = 'OK', statusCode = 200): void {
  const body: ApiResponseBody<T> = {
    success: true,
    message,
    data,
    errors: null,
    timestamp: new Date().toISOString(),
    requestId: getRequestContext()?.requestId ?? 'unknown',
  };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errors: ApiResponseBody['errors'] = null,
): void {
  const body: ApiResponseBody<never> = {
    success: false,
    message,
    data: null,
    errors,
    timestamp: new Date().toISOString(),
    requestId: getRequestContext()?.requestId ?? 'unknown',
  };
  res.status(statusCode).json(body);
}
