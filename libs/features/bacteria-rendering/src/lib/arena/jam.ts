import { Rgb } from './arena-theme';
import { Nutrient } from '@wolsok/feat-shared-bacteria-engine';
import { darker, rgba } from './canvas-math';

/** A pellet of food as a drop of jam, in one of a few flavours. */
export interface Jam {
  body: Rgb;
  light: Rgb;
}

/** Where and how big a pellet's drop of jam is drawn this frame. */
export interface JamDrop {
  jam: Jam;
  /** The centre of the drop, in arena coordinates. */
  x: number;
  y: number;
  radius: number;
  /** How bright the halo pulses, 0 to 1. */
  halo: number;
}

/**
 * The drops of jam for the pellets that are left: they wobble a little and
 * shrink as they are eaten. Both pellets of a mirrored pair get the same
 * flavour.
 */
export function jamDrops(
  nutrients: readonly Nutrient[],
  nutrientEnergy: number,
  timeSec: number,
  /** Cells per base cell - a drop is as big on every grid. */
  unit = 1
): JamDrop[] {
  const drops: JamDrop[] = [];
  for (let n = 0; n < nutrients.length; n++) {
    const nutrient = nutrients[n];
    if (nutrient.amount <= 0) {
      continue;
    }
    const left = Math.min(1, nutrient.amount / nutrientEnergy);
    const wobble = 1 + 0.08 * Math.sin(timeSec * 4 + n * 1.7);
    drops.push({
      jam: JAMS[(n >> 1) % JAMS.length],
      x: nutrient.x + 0.5,
      y: nutrient.y + 0.5,
      radius: (1.3 + 1.9 * left) * wobble * unit,
      halo: 0.5 + 0.5 * Math.sin(timeSec * 2.5 + n),
    });
  }
  return drops;
}

/** Strawberry, blueberry, apricot and blackcurrant. */
const JAMS: readonly Jam[] = [
  { body: [200, 20, 55], light: [255, 120, 140] },
  { body: [80, 40, 160], light: [170, 140, 255] },
  { body: [240, 140, 20], light: [255, 215, 120] },
  { body: [120, 10, 70], light: [220, 90, 160] },
];

/**
 * Draws the pellets as glossy drops of jam that wobble a little, with a
 * soft halo so they are easy to spot. A drop shrinks as it is eaten. The
 * context is in arena coordinates, its transform does the scaling.
 */
export function drawJam(
  cx: CanvasRenderingContext2D,
  nutrients: readonly Nutrient[],
  nutrientEnergy: number,
  timeSec: number,
  unit = 1
): void {
  for (const { jam, x, y, radius, halo } of jamDrops(
    nutrients,
    nutrientEnergy,
    timeSec,
    unit
  )) {
    cx.fillStyle = rgba(jam.light, 0.12 + 0.12 * halo);
    cx.beginPath();
    cx.arc(x, y, radius + 1.5 + halo, 0, Math.PI * 2);
    cx.fill();

    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.beginPath();
    cx.ellipse(x + 0.4, y + 0.6, radius, radius * 0.8, 0, 0, Math.PI * 2);
    cx.fill();

    const gradient = cx.createRadialGradient(
      x - radius * 0.35,
      y - radius * 0.4,
      radius * 0.1,
      x,
      y,
      radius
    );
    gradient.addColorStop(0, rgba(jam.light, 1));
    gradient.addColorStop(0.55, rgba(jam.body, 1));
    gradient.addColorStop(1, rgba(darker(jam.body), 1));
    cx.fillStyle = gradient;
    cx.beginPath();
    // Squashed a little, like a drop sitting on the agar.
    cx.ellipse(x, y, radius, radius * 0.88, 0, 0, Math.PI * 2);
    cx.fill();

    cx.fillStyle = 'rgba(255,255,255,0.8)';
    cx.beginPath();
    cx.ellipse(
      x - radius * 0.38,
      y - radius * 0.4,
      radius * 0.28,
      radius * 0.18,
      -0.6,
      0,
      Math.PI * 2
    );
    cx.fill();
  }
}
