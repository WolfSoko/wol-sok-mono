import { IMAGE_MAX, isImageData } from './profile';

/** The side of an uploaded picture, in pixels - twice the biggest shown. */
export const PICTURE_SIZE = 96;

/** The qualities tried, best first, until the picture is small enough. */
const QUALITIES = [0.85, 0.7, 0.5, 0.35];

/**
 * An image file as a small square picture for a profile: the middle of it,
 * scaled to {@link PICTURE_SIZE}, as a WebP data URL - JPEG where the
 * browser cannot write WebP. Null for a file that is not an image the
 * browser can read, or that does not get small enough.
 */
export async function shrinkImage(file: Blob): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = PICTURE_SIZE;
    canvas.height = PICTURE_SIZE;
    const context = canvas.getContext('2d');
    if (context === null) {
      return null;
    }
    const side = Math.min(bitmap.width, bitmap.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      PICTURE_SIZE,
      PICTURE_SIZE
    );
    for (const quality of QUALITIES) {
      let data = canvas.toDataURL('image/webp', quality);
      // A browser without a WebP encoder hands back a PNG.
      if (!data.startsWith('data:image/webp')) {
        data = canvas.toDataURL('image/jpeg', quality);
      }
      if (data.length <= IMAGE_MAX && isImageData(data)) {
        return data;
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}
