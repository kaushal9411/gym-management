/**
 * Member QR codes encode `fitcloud-member:{tenantId}:{token}` (see
 * `buildQrCode` in the API's member service) — a camera scan decodes that
 * full string, but the validate-qr endpoint expects just the opaque token.
 * Manually-pasted input (the fallback path) is usually just the raw token
 * already, so this only rewrites strings that actually match the prefix.
 */
export function extractQrToken(decoded: string): string {
  const trimmed = decoded.trim();
  const match = /^fitcloud-member:[^:]+:(.+)$/.exec(trimmed);
  return match ? match[1]! : trimmed;
}
