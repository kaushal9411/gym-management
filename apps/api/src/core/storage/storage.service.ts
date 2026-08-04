import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../../config/env';
import { logger } from '../logging/logger';

import { getS3Client } from './s3-client';

const DATA_URL_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/s;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && DATA_URL_RE.test(value);
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error('Not a valid data-URL.');
  const contentType = match[1]!;
  const base64 = match[2]!;
  return { buffer: Buffer.from(base64, 'base64'), contentType, ext: EXT_BY_MIME[contentType] ?? contentType.split('/')[1] ?? 'bin' };
}

let warnedOnce = false;

/**
 * The one place a data-URL upload gets turned into an object-storage
 * write. `visibility: 'public'` objects live under the bucket's
 * `public/` prefix (anonymous-readable — see `minio-init` in
 * docker-compose.yml / the bucket policy in production) and this returns
 * a stable, directly-usable URL, so every existing `<img src>`/`<a href>`
 * read path needs zero changes — same drop-in-place contract the raw
 * data-URL had. `visibility: 'private'` objects (member documents, expense
 * receipts — genuinely sensitive) live under `private/` with no public
 * policy; this returns a bare object KEY instead of a URL, and the caller
 * MUST turn that into a fresh `presignGetUrl()` at read time — never store
 * a permanent private URL.
 *
 * Gracefully degrades to returning the input unchanged when object storage
 * isn't configured (`env.storage.isConfigured`), so a dev machine that
 * hasn't run `docker compose up minio minio-init` yet keeps working
 * exactly as before this migration — this is additive, not a breaking
 * requirement.
 */
export async function uploadDataUrl(dataUrl: string, opts: { keyPrefix: string; visibility: 'public' | 'private' }): Promise<string> {
  if (!env.storage.isConfigured) {
    if (!warnedOnce) {
      logger.warn('Object storage is not configured — uploads are being stored as base64 data-URLs in Postgres. Set S3_* env vars to fix this.');
      warnedOnce = true;
    }
    return dataUrl;
  }

  const { buffer, contentType, ext } = parseDataUrl(dataUrl);
  const key = `${opts.visibility}/${opts.keyPrefix}/${randomUUID()}.${ext}`;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.storage.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return opts.visibility === 'public' ? `${env.storage.publicUrlBase}/${key}` : key;
}

/** For `private`-visibility objects — turns the stored bare key into a short-lived, authenticated-read-only URL. Call this fresh on every response; never persist the result. */
export async function presignGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  if (!env.storage.isConfigured) return key; // degraded mode — the "key" is actually still the raw data-URL (see uploadDataUrl above).
  return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: env.storage.bucket, Key: key }), { expiresIn: expiresInSeconds });
}
