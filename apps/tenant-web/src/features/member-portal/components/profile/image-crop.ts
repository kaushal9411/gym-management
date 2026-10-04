/**
 * Center-crop to a square, downscale to `size`, encode JPEG. The shared
 * `fileToDataUrl` doesn't crop, so this stays local. Lowers quality until the
 * data URL is under `maxChars` (API caps the body at ~1 MB / ~740 KB decoded).
 */
export async function fileToSquareJpeg(file: File, size = 512, maxChars = 900_000): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('We could not read this image. Please choose a JPEG, PNG or WebP photo.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser cannot process images.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close?.();
  for (const q of [0.85, 0.75, 0.65, 0.5, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length < maxChars) return url;
  }
  throw new Error('This photo is too large to upload. Try a smaller one.');
}
