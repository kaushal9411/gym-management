import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

import { sniffFileType } from '../../../core/storage/file-signature.util';
import { LOCAL_UPLOADS_DIR } from '../../../core/storage/local-storage.util';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 4000;

/** pdfkit embeds only PNG and JPEG — webp/gif/svg fall back to the initials tile. */
export function isPdfEmbeddableImage(buffer: Buffer): boolean {
  const type = sniffFileType(buffer);
  return type === 'image/png' || type === 'image/jpeg';
}

async function readBytes(logoUrl: string): Promise<Buffer | null> {
  const dataMatch = /^data:[^;]+;base64,(.+)$/s.exec(logoUrl);
  if (dataMatch) return Buffer.from(dataMatch[1]!, 'base64');

  let url: URL;
  try {
    url = new URL(logoUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  // Local-disk storage fallback (`/uploads` static route) — read the file directly instead of looping back through HTTP.
  if (url.pathname.startsWith('/uploads/')) {
    const key = normalize(decodeURIComponent(url.pathname.slice('/uploads/'.length)));
    if (!key.startsWith('..')) {
      try {
        return await readFile(join(LOCAL_UPLOADS_DIR, key));
      } catch {
        /* fall through to HTTP */
      }
    }
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Best-effort logo bytes for the invoice PDF: `null` on ANY failure or unsupported format — a bad logo must never break the download. */
export async function loadInvoiceLogo(logoUrl: string | null | undefined): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    const bytes = await readBytes(logoUrl);
    if (!bytes || bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
    return isPdfEmbeddableImage(bytes) ? bytes : null;
  } catch {
    return null;
  }
}
