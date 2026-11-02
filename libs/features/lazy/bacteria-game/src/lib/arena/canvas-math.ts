import { clamp } from '../state/geometry';
import { Rgb } from './arena-theme';

/** A repeatable pseudo random number from 0 to 1 for a lattice point. */
export function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ (seed * 1442695);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 0 below `from`, 1 above `to`, and a smooth S-curve in between. */
export function smoothstep(from: number, to: number, value: number): number {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

/** The value `t` of the way from `a` to `b`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** The colour `t` of the way from `a` to `b`. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** The colour as a CSS `rgba()` string, its channels rounded. */
export function rgba([r, g, b]: Rgb, alpha = 1): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}

/** An offscreen canvas of that size, or null outside a browser. */
export function createCanvas(
  width: number,
  height: number
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Puts RGBA pixels on a canvas through its context - false without one, as
 * in the test DOM.
 */
export function putPixels(
  cx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
    | undefined,
  data: Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  if (cx == null) {
    return false;
  }
  const image = cx.createImageData(width, height);
  image.data.set(data);
  cx.putImageData(image, 0, 0);
  return true;
}

/**
 * Smoothly interpolated noise on an integer lattice, from 0 to 1 - the
 * `valueNoise` of the colony shader, on its own hash: the two agree on the
 * look of a noise, not on its every value.
 */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lerp(hash(ix, iy, seed), hash(ix + 1, iy, seed), sx);
  const bottom = lerp(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), sx);
  return lerp(top, bottom, sy);
}

/** Three octaves of {@link valueNoise}, from 0 to 1 - the shader's `fbm`. */
export function fbm(x: number, y: number, seed: number): number {
  let sum = 0;
  let amplitude = 0.5;
  for (let i = 0; i < 3; i++) {
    sum += amplitude * valueNoise(x, y, seed);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 17.1;
    amplitude *= 0.5;
  }
  return sum / 0.875;
}
