import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';

import { ValidationError } from '../errors/app-error';

interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

function formatZodError(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({ field: issue.path.join('.') || '(root)', message: issue.message }));
}

/**
 * Validates and REPLACES req.body/query/params with the parsed (and
 * type-coerced/defaulted) result — downstream code only ever sees
 * already-validated data. Every request body in this API goes through
 * this middleware; there is no unvalidated ingress.
 */
export function validate(targets: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (targets.body) req.body = targets.body.parse(req.body);
      if (targets.query) req.query = targets.query.parse(req.query) as typeof req.query;
      if (targets.params) req.params = targets.params.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError('Request validation failed', { fields: formatZodError(error) }));
        return;
      }
      next(error);
    }
  };
}
