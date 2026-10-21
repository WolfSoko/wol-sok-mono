import { scaleOf } from '../state/arena-size';
import { ArenaPainter } from './arena-painter';
import { CanvasArenaPainter } from './canvas-arena-painter';
import { GlArenaPainter } from './gl/gl-arena-painter';

/**
 * The painter for the arena canvas: on the GPU through WebGL2 where the
 * browser has it, with the Canvas 2D API otherwise. Null when the canvas
 * gives neither, as in a test without a real canvas.
 *
 * The canvas is sized here - `scale` canvas pixels per arena cell - and
 * nowhere else. `unit` is the arena's cells per base cell, which the jam,
 * the crosshairs and the marks are drawn as big as on every grid with.
 */
export function createArenaPainter(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  scale: number,
  unit = scaleOf(width)
): ArenaPainter | null {
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const gl = GlArenaPainter.create(canvas, width, height, unit);
  if (gl != null) {
    return gl;
  }
  const cx = canvas.getContext('2d');
  return cx == null
    ? null
    : new CanvasArenaPainter(cx, width, height, scale, unit);
}
