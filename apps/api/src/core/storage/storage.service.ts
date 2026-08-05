import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../../config/env';
import { ValidationError } from '../errors/app-error';
import { logger } from '../logging/logger';

import { categoryOf, sniffFileType, type FileCategory } from './file-signature.util';
import { getS3Client } from './s3-client';

const DATA_URL_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/s;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && DATA_URL_RE.test(value);
}

function parseDataUrl(dataUrl: string): { buffer: Buffer } {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new ValidationError('Not a valid data-URL.');
  const base64 = match[2]!;
  return { buffer: Buffer.from(base64, 'base64') };
}

/**
 * The real security boundary: sniffs the buffer's magic bytes and rejects
 * anything that doesn't match a real, allowed file signature — the
 * client-asserted `data:<mime>;base64,` prefix is never trusted for the
 * actual `ContentType`/extension, the sniffed type is (see `uploadDataUrl`
 * below). Runs even when object storage isn't configured (degraded mode
 * still persists the data-URL to Postgres — this must not become a way to
 * skip validation just because MinIO isn't running locally).
 */
function verifyFileType(buffer: Buffer, accept: FileCategory[]): { contentType: string; ext: string } {
  const sniffed = sniffFileType(buffer);
  if (!sniffed) throw new ValidationError('This file does not look like a supported image or PDF. Choose a different file.');
  if (!accept.includes(categoryOf(sniffed))) {
    throw new ValidationError(`This upload only accepts ${accept.join('/')} files.`);
  }
  return { contentType: sniffed, ext: EXT_BY_MIME[sniffed]! };
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
 * requirement. File-type validation (`verifyFileType`) still runs in this
 * degraded mode — it's a content-safety check, not an object-storage
 * concern, so it must not depend on MinIO being configured.
 *
 * `accept` defaults to images only — pass `['image', 'pdf']` for the
 * handful of upload fields that genuinely need PDFs too (member documents,
 * expense receipts). The sniffed type (never the client-claimed one)
 * becomes the real `ContentType`/extension.
 */
export async function uploadDataUrl(
  dataUrl: string,
  opts: { keyPrefix: string; visibility: 'public' | 'private'; accept?: FileCategory[] },
): Promise<string> {
  const { buffer } = parseDataUrl(dataUrl);
  const { contentType, ext } = verifyFileType(buffer, opts.accept ?? ['image']);

  if (!env.storage.isConfigured) {
    if (!warnedOnce) {
      logger.warn('Object storage is not configured — uploads are being stored as base64 data-URLs in Postgres. Set S3_* env vars to fix this.');
      warnedOnce = true;
    }
    return dataUrl;
  }

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
