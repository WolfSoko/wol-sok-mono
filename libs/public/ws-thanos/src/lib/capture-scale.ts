const MAX_DEVICE_PIXEL_RATIO = 2;

export interface CaptureScaleParams {
  width: number;
  height: number;
  /** the effect canvas size in element sizes, see effectScale() */
  effectScale: { width: number; height: number };
  devicePixelRatio: number;
  maxCanvasSize: number;
  /** the most pixels to capture the element with, no limit when unset */
  maxCapturePixels?: number;
}

/**
 * Scale that captures an element of the given css size with at most maxCapturePixels pixels,
 * Infinity without a limit: a missing, zero, negative or NaN one.
 */
export function capturePixelsScale(
  width: number,
  height: number,
  maxCapturePixels?: number
): number {
  return maxCapturePixels != null && maxCapturePixels > 0
    ? Math.sqrt(maxCapturePixels / Math.max(1, width * height))
    : Infinity;
}

/**
 * Scale used to capture the element: device pixels for crisp particles,
 * but small enough that the effect canvas fits the device's max canvas size
 * and the element stays within maxCapturePixels, below css pixels if needed.
 */
export function computeCaptureScale({
  width,
  height,
  effectScale,
  devicePixelRatio,
  maxCanvasSize,
  maxCapturePixels,
}: CaptureScaleParams): number {
  const pixelRatio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(
    pixelRatio,
    MAX_DEVICE_PIXEL_RATIO,
    capturePixelsScale(width, height, maxCapturePixels),
    maxCanvasSize / Math.max(1, width * effectScale.width),
    maxCanvasSize / Math.max(1, height * effectScale.height)
  );
}
