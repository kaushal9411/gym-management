/**
 * Sniffs a file's real type from its magic bytes — the authoritative check
 * for every upload, since the client-asserted `data:<mime>;base64,` prefix
 * a data-URL carries is just a string the client wrote and proves nothing
 * about the bytes that follow (a renamed executable can claim
 * `image/jpeg` just as easily as a real JPEG can). No SVG signature exists
 * here on purpose — SVG is XML text, not a binary format with a fixed
 * header, so a magic-byte check can't distinguish a safe image from one
 * carrying an embedded `<script>`; SVG uploads are disallowed entirely
 * rather than half-validated (see the removed `image/svg+xml` entries in
 * `storage.service.ts` / the settings & workout validators).
 */

export type SniffedFileType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';

export type FileCategory = 'image' | 'pdf';

const CATEGORY_BY_TYPE: Record<SniffedFileType, FileCategory> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'application/pdf': 'pdf',
};

function matches(buffer: Buffer, offset: number, bytes: number[]): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/** Returns the sniffed MIME type, or `null` if the bytes don't match any supported signature. */
export function sniffFileType(buffer: Buffer): SniffedFileType | null {
  if (matches(buffer, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (matches(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (matches(buffer, 0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'; // "GIF8" — covers both GIF87a/GIF89a
  if (matches(buffer, 0, [0x52, 0x49, 0x46, 0x46]) && matches(buffer, 8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp'; // "RIFF"…"WEBP"
  if (matches(buffer, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // "%PDF-"
  return null;
}

export function categoryOf(type: SniffedFileType): FileCategory {
  return CATEGORY_BY_TYPE[type];
}
