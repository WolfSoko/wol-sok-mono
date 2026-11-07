import { boostRingRadius, crosshairBars, CursorShape } from './arena-painter';

/**
 * Draws each player's crosshair in their own colour, with a ring around it
 * while the player's boost is running - `unit` cells per base cell, so it is
 * as big on every grid.
 */
export function drawCursors(
  cx: CanvasRenderingContext2D,
  cursors: readonly CursorShape[],
  unit: number
): void {
  for (const cursor of cursors) {
    const css = `rgba(${cursor.color.join(',')})`;
    cx.fillStyle = css;
    for (const bar of crosshairBars(cursor, unit)) {
      cx.fillRect(bar.x, bar.y, bar.width, bar.height);
    }

    if (cursor.boostLeft != null) {
      cx.strokeStyle = css;
      cx.lineWidth = 1.5 * unit;
      cx.beginPath();
      cx.arc(
        cursor.x,
        cursor.y,
        boostRingRadius(cursor.boostLeft) * unit,
        0,
        Math.PI * 2
      );
      cx.stroke();
    }
  }
}
