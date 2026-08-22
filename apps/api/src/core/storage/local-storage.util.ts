import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { env } from '../../config/env';

/**
 * Dev/no-AWS-credentials fallback for `storage.service.ts`. Files live on
 * local disk under this directory and are served back out via the
 * `/uploads` static route mounted in `app.ts`. Not a substitute for S3 in
 * production — anything under here is lost if the container is recreated,
 * and (like S3's `public/` prefix) is served with no auth check, so this is
 * only appropriate for local/dev use.
 */
export const LOCAL_UPLOADS_DIR = join(process.cwd(), 'uploads');

/** Writes `buffer` to `LOCAL_UPLOADS_DIR/key` (creating subdirectories as needed) and returns the public URL it's reachable at. */
export async function saveLocalFile(key: string, buffer: Buffer): Promise<string> {
  const filePath = join(LOCAL_UPLOADS_DIR, key);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return localFileUrl(key);
}

export function localFileUrl(key: string): string {
  return `${env.publicUrl}/uploads/${key}`;
}
