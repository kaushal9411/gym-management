import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../../config/env';
import { ValidationError } from '../errors/app-error';
import { logger } from '../logging/logger';

import { categoryOf, sniffFileType, type FileCategory } from './file-signature.util';
import { localFileUrl, saveLocalFile } from './local-storage.util';
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
 * below). Runs identically whether the file ends up on S3 or local disk —
 * this must not become a way to skip validation just because AWS
 * credentials aren't configured.
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
 * write. `visibility: 'public'` objects live under the bucket's `public/`
 * prefix (anonymous-readable — see the bucket policy in production) and
 * this returns a stable, directly-usable URL, so every existing
 * `<img src>`/`<a href>` read path needs zero changes — same
 * drop-in-place contract the raw data-URL had. `visibility: 'private'`
 * objects (member documents, expense receipts — genuinely sensitive) live
 * under `private/` with no public policy; this returns a bare object KEY
 * instead of a URL, and the caller MUST turn that into a fresh
 * `presignGetUrl()` at read time — never store a permanent private URL.
 *
 * AWS credentials configured (`env.storage.isConfigured`) → uploads to S3.
 * Not configured → falls back to local disk (`local-storage.util.ts`), so a
 * dev machine with no AWS account keeps working unchanged. File-type
 * validation (`verifyFileType`) always runs first regardless of which
 * backend is used — it's a content-safety check, not an object-storage
 * concern.
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
  const key = `${opts.visibility}/${opts.keyPrefix}/${randomUUID()}.${ext}`;

  if (!env.storage.isConfigured) {
    if (!warnedOnce) {
      logger.warn('AWS S3 is not configured (S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY) — uploads are being stored on local disk instead.');
      warnedOnce = true;
    }
    const url = await saveLocalFile(key, buffer);
    return opts.visibility === 'public' ? url : key;
  }

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
  if (!env.storage.isConfigured) return localFileUrl(key); // local-disk fallback — see uploadDataUrl above.
  return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: env.storage.bucket, Key: key }), { expiresIn: expiresInSeconds });
}
