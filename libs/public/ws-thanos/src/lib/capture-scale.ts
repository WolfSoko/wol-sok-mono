/** the effect canvas is wider and taller than the element so particles have room to fly */
export const EFFECT_WIDTH_SCALE = 2;
export const EFFECT_HEIGHT_SCALE = 5;
const MAX_DEVICE_PIXEL_RATIO = 2;

export interface CaptureScaleParams {
  width: number;
  height: number;
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
  devicePixelRatio,
  maxCanvasSize,
  maxCapturePixels,
}: CaptureScaleParams): number {
  const pixelRatio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(
    pixelRatio,
    MAX_DEVICE_PIXEL_RATIO,
    capturePixelsScale(width, height, maxCapturePixels),
    maxCanvasSize / Math.max(1, width * EFFECT_WIDTH_SCALE),
    maxCanvasSize / Math.max(1, height * EFFECT_HEIGHT_SCALE)
  );
}
