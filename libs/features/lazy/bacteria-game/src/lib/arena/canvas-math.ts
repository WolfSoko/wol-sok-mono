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
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** The colour as a CSS `rgba()` string, its channels rounded. */
export function rgba([r, g, b]: Rgb, alpha = 1): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}
