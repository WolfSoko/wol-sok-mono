import { RANKS, rankFor } from '@wolsok/feat-shared-bacteria-engine';

/** An RGB colour, each channel 0 to 1, as the shader takes it. */
export type Rgb = readonly [number, number, number];

/**
 * What the main menu's bacterium looks like at a player's progress (#3194):
 * a Spore's cell is a plain, quiet capsule; each rank adds flagella, pili,
 * organelles, glow and life, up to a Superbug's.
 */
export interface BacteriumLook {
  /** From 0 (a new Spore) to 1 (Superbug): the rank and the way to the next. */
  growth: number;
  /** Whip-like tails trailing from the cell's poles, 0 to 6. */
  flagella: number;
  /** Hair-like spikes round the membrane, 0 for a smooth one. */
  pili: number;
  /** Specks inside the cell, glowing through the membrane, 1 to 8. */
  organelles: number;
  /** The rim light's strength, 0 to 1. */
  glow: number;
  /** How much the membrane breathes, in the cell's half height. */
  wobble: number;
  /** The membrane's and the rim light's colours. */
  body: Rgb;
  rim: Rgb;
}

const MAX_FLAGELLA = 6;
const MAX_PILI = 36;
const MAX_ORGANELLES = 8;

/** The cell's colours from a Spore (first) to a Superbug (last). */
const PALETTE: readonly { body: Rgb; rim: Rgb }[] = [
  { body: [0.16, 0.42, 0.36], rim: [0.45, 0.95, 0.8] },
  { body: [0.12, 0.36, 0.48], rim: [0.4, 0.85, 1] },
  { body: [0.3, 0.2, 0.5], rim: [0.78, 0.55, 1] },
  { body: [0.48, 0.32, 0.1], rim: [1, 0.78, 0.32] },
];

/** The look a player's XP earns. */
export function bacteriumLook(xp: number): BacteriumLook {
  const standing = rankFor(xp);
  const growth = Math.min(
    1,
    (standing.number - 1 + standing.progress) / (RANKS.length - 1)
  );
  const colour = blend(growth);
  return {
    growth,
    flagella: Math.round(growth * MAX_FLAGELLA),
    pili: growth < 0.2 ? 0 : Math.round(growth * MAX_PILI),
    organelles: 1 + Math.round(growth * (MAX_ORGANELLES - 1)),
    glow: 0.25 + 0.75 * growth,
    wobble: 0.012 + 0.03 * growth,
    body: colour.body,
    rim: colour.rim,
  };
}

/** The palette's colour at `growth`, between its two nearest entries. */
function blend(growth: number): { body: Rgb; rim: Rgb } {
  const at = growth * (PALETTE.length - 1);
  const low = PALETTE[Math.floor(at)];
  const high = PALETTE[Math.min(PALETTE.length - 1, Math.floor(at) + 1)];
  const t = at - Math.floor(at);
  return {
    body: mixRgb(low.body, high.body, t),
    rim: mixRgb(low.rim, high.rim, t),
  };
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** A colour as CSS `rgb()`, for the cell drawn without WebGL. */
export function cssRgb([r, g, b]: Rgb, alpha = 1): string {
  const channel = (value: number) => Math.round(value * 255);
  return `rgb(${channel(r)} ${channel(g)} ${channel(b)} / ${alpha})`;
}
