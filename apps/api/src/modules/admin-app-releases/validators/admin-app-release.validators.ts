import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid() });

/**
 * Multipart form fields arrive as strings on `req.body` (multer parses the
 * file separately onto `req.file`), so `versionCode`/`activate` are coerced
 * here rather than typed as their eventual JS types — same reasoning as
 * every other multipart-adjacent schema in this codebase's query-param
 * validators.
 */
export const createAppReleaseSchema = z.object({
  version: z.string().trim().min(1).max(40),
  versionCode: z.coerce.number().int().positive(),
  releaseNotes: z.string().trim().max(4000).optional(),
  activate: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
});
