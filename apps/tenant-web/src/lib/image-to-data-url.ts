/**
 * Client-side downscale-and-encode for image uploads — reused by every
 * "upload with preview" field in the app (IAM avatar, Gym Settings
 * branding assets). No object storage exists yet, so the backend stores
 * these as inline data: URLs; keeping dimensions small here is what keeps
 * that payload well under the API's 1MB JSON body cap.
 */
export async function fileToDataUrl(file: File, maxDimension: number, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Raw file → data-URL with no resize — for uploads that can't go through a
 * canvas (PDFs, other documents). Used by Member document uploads; images
 * still go through `fileToDataUrl` above for the size win, everything else
 * (PDF, etc.) is read as-is, capped so the inline-data-URL payload stays
 * reasonable (no object storage exists yet — see docs/BACKEND-GUIDE.md).
 */
export function fileToRawDataUrl(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    return Promise.reject(new Error(`File is too large — max ${Math.round(maxBytes / 1024 / 1024)}MB.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}
