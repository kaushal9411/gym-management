import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../../config/env';

/**
 * AES-256-GCM for the small set of genuine tenant-supplied secrets this app
 * stores at rest (currently: a tenant's own AI provider API key,
 * `TenantAiSettings.apiKeyEncrypted`) — distinct from `token.util.ts`'s
 * one-way hashing (refresh tokens/resets), since these need to be
 * RECOVERED (sent to the AI provider), not just verified.
 *
 * Stored format: `{ivBase64}:{authTagBase64}:{ciphertextBase64}` — a fresh
 * random IV per encryption call (GCM requires a unique IV per key; reusing
 * one breaks its confidentiality guarantee), the auth tag kept alongside so
 * `decryptSecret` can verify integrity before returning anything.
 */
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = Buffer.from(env.encryptionKey, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded AES-256 key).');
  }
  return key;
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Malformed encrypted secret.');

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}

/** Last 4 characters only — enough for a user to recognize "yes, that's my key" without ever re-displaying the secret. */
export function maskSecret(plainText: string): string {
  return plainText.length <= 4 ? '••••' : `••••${plainText.slice(-4)}`;
}
