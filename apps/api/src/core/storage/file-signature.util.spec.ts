import { describe, expect, it } from 'vitest';

import { categoryOf, sniffFileType } from './file-signature.util';

describe('sniffFileType', () => {
  it('recognizes a real JPEG', () => {
    expect(sniffFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe('image/jpeg');
  });

  it('recognizes a real PNG', () => {
    expect(sniffFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]))).toBe('image/png');
  });

  it('recognizes a real GIF', () => {
    expect(sniffFileType(Buffer.from('GIF89a', 'ascii'))).toBe('image/gif');
  });

  it('recognizes a real WEBP (RIFF…WEBP container)', () => {
    const buf = Buffer.alloc(16);
    buf.write('RIFF', 0, 'ascii');
    buf.write('WEBP', 8, 'ascii');
    expect(sniffFileType(buf)).toBe('image/webp');
  });

  it('recognizes a real PDF', () => {
    expect(sniffFileType(Buffer.from('%PDF-1.4\n', 'ascii'))).toBe('application/pdf');
  });

  it('rejects a renamed-executable-style payload that merely CLAIMS to be an image', () => {
    // An MZ/PE header (real Windows executable magic bytes) — this is exactly
    // the attack this check exists to catch: a client can set the data-URL's
    // `image/jpeg` prefix to whatever it wants, but the actual bytes here are
    // not a JPEG, and must be rejected regardless of what the prefix claims.
    expect(sniffFileType(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]))).toBeNull();
  });

  it('rejects plain text / arbitrary bytes', () => {
    expect(sniffFileType(Buffer.from('just some plain text, not a file', 'utf8'))).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(sniffFileType(Buffer.alloc(0))).toBeNull();
  });

  it('does not misidentify a RIFF file that is not WEBP (e.g. a WAV)', () => {
    const buf = Buffer.alloc(16);
    buf.write('RIFF', 0, 'ascii');
    buf.write('WAVE', 8, 'ascii');
    expect(sniffFileType(buf)).toBeNull();
  });
});

describe('categoryOf', () => {
  it('maps every image type to "image"', () => {
    expect(categoryOf('image/jpeg')).toBe('image');
    expect(categoryOf('image/png')).toBe('image');
    expect(categoryOf('image/webp')).toBe('image');
    expect(categoryOf('image/gif')).toBe('image');
  });

  it('maps PDF to "pdf"', () => {
    expect(categoryOf('application/pdf')).toBe('pdf');
  });
});
