/** The most device pixels a CSS pixel of the cell gets. */
const MAX_PIXEL_SCALE = 1.5;

/**
 * The most pixels the cell's drawing buffer holds (#3226), about a
 * full-HD screen's worth: the shader runs once a pixel every frame, so a
 * cell filling a widescreen menu would otherwise cost several times as
 * much as one at 1920 x 1080. Past it the browser scales the canvas up,
 * which the soft, glowing cell takes without visible loss.
 */
export const MAX_BUFFER_PIXELS = 2_000_000;

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
