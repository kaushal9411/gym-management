import { createHmac } from 'node:crypto';

import { env } from '../../config/env';

/**
 * Deterministic HMAC-SHA256 "blind index" for exact-match lookups on
 * AES-256-GCM-encrypted columns (see `encryption.util.ts`) — GCM's random
 * IV makes ciphertext non-deterministic, so uniqueness/equality checks need
 * a separate deterministic hash column instead of a `WHERE column = value`
 * against the ciphertext itself. Derives its own subkey from
 * `ENCRYPTION_KEY` via HMAC with a fixed context string, rather than
 * reusing the raw AES key for a second purpose or requiring a second env var.
 */
let cachedSubkey: Buffer | null = null;

function subkey(): Buffer {
  if (!cachedSubkey) {
    const masterKey = Buffer.from(env.encryptionKey, 'base64');
    cachedSubkey = createHmac('sha256', masterKey).update('blind-index-v1').digest();
  }
  return cachedSubkey;
}

export function blindIndex(value: string): string {
  return createHmac('sha256', subkey()).update(value).digest('hex');
}
