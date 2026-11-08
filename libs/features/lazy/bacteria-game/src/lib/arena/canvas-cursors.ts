import {
  boostRing,
  crosshairBars,
  splitColor,
  CursorShape,
} from './arena-painter';
import { rgba } from './canvas-math';

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
    const { rgb, alpha } = splitColor(cursor.color);
    const css = rgba(rgb, alpha);
    cx.fillStyle = css;
    for (const bar of crosshairBars(cursor, unit)) {
      cx.fillRect(bar.x, bar.y, bar.width, bar.height);
    }

    const ring = boostRing(cursor, unit);
    if (ring) {
      cx.strokeStyle = css;
      cx.lineWidth = ring.lineWidth;
      cx.beginPath();
      cx.arc(cursor.x, cursor.y, ring.radius, 0, Math.PI * 2);
      cx.stroke();
    }
  }
}
