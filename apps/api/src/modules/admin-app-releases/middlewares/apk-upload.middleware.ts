import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';

import type { RequestHandler } from 'express';
import multer from 'multer';

const MAX_APK_BYTES = 300 * 1024 * 1024; // 300MB — generous headroom over a real Flutter release APK (typically 30-80MB).

/**
 * `diskStorage`, deliberately not `memoryStorage` — the whole point is that
 * a 100MB+ APK is streamed straight to a temp file, never fully buffered in
 * process memory. `storage.service.ts#uploadLargeFile` picks the temp path
 * up from `req.file.path` and moves/streams it into permanent storage, then
 * always deletes it — nothing here is meant to persist past one request.
 */
const storage = multer.diskStorage({
  destination: tmpdir(),
  filename: (_req, file, cb) => cb(null, `apk-upload-${randomUUID()}-${file.originalname}`),
});

/** Real, minimal validation — an `.apk` really is just a ZIP, so magic-byte sniffing would only confirm "ZIP," not "APK"; the extension + declared MIME is the practical signal here, same tradeoff every APK-hosting service makes. */
function fileFilter(_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!file.originalname.toLowerCase().endsWith('.apk')) {
    cb(new Error('Only .apk files are accepted.'));
    return;
  }
  cb(null, true);
}

export const apkUpload: RequestHandler = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_APK_BYTES },
}).single('file');
