/** the effect canvas is wider and taller than the element so particles have room to fly */
export const EFFECT_WIDTH_SCALE = 2;
export const EFFECT_HEIGHT_SCALE = 5;
const MAX_DEVICE_PIXEL_RATIO = 2;

export interface CaptureScaleParams {
  width: number;
  height: number;
  devicePixelRatio: number;
  maxCanvasSize: number;
}

/**
 * Scale used to capture the element: device pixels for crisp particles,
 * but small enough that the effect canvas fits the device's max canvas size.
 */
export function computeCaptureScale({
  width,
  height,
  devicePixelRatio,
  maxCanvasSize,
}: CaptureScaleParams): number {
  const pixelRatio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(
    pixelRatio,
    MAX_DEVICE_PIXEL_RATIO,
    maxCanvasSize / Math.max(1, width * EFFECT_WIDTH_SCALE),
    maxCanvasSize / Math.max(1, height * EFFECT_HEIGHT_SCALE)
  );
}
