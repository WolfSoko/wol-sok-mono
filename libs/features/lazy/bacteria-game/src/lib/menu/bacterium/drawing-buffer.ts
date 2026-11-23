/** The most device pixels a CSS pixel of the cell gets. */
const MAX_PIXEL_SCALE = 1.5;

/**
 * The most pixels the cell's drawing buffer holds (#3226). The shader runs
 * once a pixel every frame, so a cell filling a 5K screen would cost
 * several times one at 1920 x 1080. The budget still draws the cell at one
 * device pixel a CSS pixel on a 3750 x 1825 screen (about 2000 x 1500):
 * below that its membrane's edge shows steps. Past it the browser scales
 * the canvas up.
 */
export const MAX_BUFFER_PIXELS = 3_500_000;

/** A drawing buffer's size in device pixels. */
export interface BufferSize {
  width: number;
  height: number;
}

/**
 * The drawing buffer for a cell of `width` x `height` CSS pixels on a
 * screen of `devicePixelRatio`: the device's pixels up to
 * `MAX_PIXEL_SCALE`, lowered where that exceeds `MAX_BUFFER_PIXELS`.
 */
export function drawingBufferSize(
  width: number,
  height: number,
  devicePixelRatio: number
): BufferSize {
  const budgetScale = Math.sqrt(
    MAX_BUFFER_PIXELS / Math.max(1, width * height)
  );
  const scale = Math.min(devicePixelRatio, MAX_PIXEL_SCALE, budgetScale);
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}
