/**
 * Client-side downscale-and-encode for image uploads — same helper
 * tenant-web uses for avatar/branding uploads. No dedicated upload widget
 * exists yet for the handful of admin-side image fields (currently just the
 * "Mark Paid Manually" proof-of-payment screenshot), so this keeps the
 * payload well under the API's 1MB JSON body cap by resizing before encoding.
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
