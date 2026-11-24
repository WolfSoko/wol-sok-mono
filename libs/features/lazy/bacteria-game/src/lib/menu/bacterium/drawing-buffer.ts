import { CELL_SCALE } from './bacterium-items';

/** The most device pixels a CSS pixel of the cell gets. */
const MAX_PIXEL_SCALE = 1.5;

/**
 * The most pixels the cell's box gets (#3226). The shader runs once a
 * pixel every frame, so a cell filling a 5K screen would cost several
 * times one at 1920 x 1080. The budget still draws the cell at one device
 * pixel a CSS pixel on a 3750 x 1825 screen (about 2000 x 1500): below
 * that its membrane's edge shows steps. Past it the browser scales the
 * canvas up.
 */
export const MAX_BOX_PIXELS = 3_500_000;

/**
 * The most pixels the cell's canvas holds: the box's budget, and as much
 * for the bleed round it (#3240), so the canvas reaching past the box
 * costs the cell no sharpness. Its pixels miss the cell within a few
 * raymarch steps.
 */
export const MAX_BUFFER_PIXELS = MAX_BOX_PIXELS * CELL_SCALE ** 2;

/** A drawing buffer's size in device pixels. */
export interface BufferSize {
  width: number;
  height: number;
}

/**
 * The drawing buffer for a canvas of `width` x `height` CSS pixels on a
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
  const wanted = Math.min(devicePixelRatio, MAX_PIXEL_SCALE);
  // Rounded as ever within the budget; past it rounded down, to stay in it.
  const fit = budgetScale < wanted ? Math.floor : Math.round;
  const scale = Math.min(wanted, budgetScale);
  return {
    width: Math.max(1, fit(width * scale)),
    height: Math.max(1, fit(height * scale)),
  };
}
