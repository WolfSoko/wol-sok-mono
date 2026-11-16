import { isSoftwareRenderer, webGlRenderer } from '../gl/renderer';
import { ArenaLayout, ArenaPainter } from './arena-painter';
import { CanvasArenaPainter } from './canvas-arena-painter';
import { GlArenaPainter } from './gl/gl-arena-painter';

/**
 * The painter for the arena canvas: on the GPU through WebGL2 where the
 * browser has it on a GPU, with the Canvas 2D API otherwise - where WebGL2
 * renders on the CPU, Canvas 2D draws the arena two to three times as
 * fast, with every pixel. The layout keeps WebGL2 there for a war that runs
 * in its context. Null when the canvas gives neither, as in a test without
 * a real canvas.
 *
 * Which one is asked of a throwaway context first: once a canvas has one
 * kind of context, it gives no other.
 *
 * The canvas is sized here - `scale` canvas pixels per arena cell, with
 * all of it in view - and nowhere else. `detail` is the pixels per cell the
 * zones are painted with, as fine as the camera ever shows them. `unit` is
 * the arena's cells per base cell, which the jam, the crosshairs and the
 * marks are drawn as big as on every grid with.
 */
export function createArenaPainter(
  canvas: HTMLCanvasElement,
  layout: ArenaLayout
): ArenaPainter | null {
  const { width, height, scale, detail, unit } = layout;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const gl = paintsWithWebGl(layout)
    ? GlArenaPainter.create(canvas, width, height, detail, unit)
    : null;
  if (gl != null) {
    return gl;
  }
  const cx = canvas.getContext('2d');
  return cx == null
    ? null
    : new CanvasArenaPainter(cx, width, height, detail, unit);
}

/** False where WebGL2 renders on the CPU and the layout does not ask for it. */
function paintsWithWebGl(layout: ArenaLayout): boolean {
  if (layout.softwareWebGl) {
    return true;
  }
  const renderer = webGlRenderer();
  return renderer !== null && !isSoftwareRenderer(renderer);
}
