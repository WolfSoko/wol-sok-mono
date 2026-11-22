import { type Rgb as ColonyRgb } from '@wolsok/feat-bacteria-rendering';
import { RANKS, rankFor } from '@wolsok/feat-shared-bacteria-engine';

/** An RGB colour, each channel 0 to 1, as the shader takes it. */
export type Rgb = readonly [number, number, number];

/**
 * What the main menu's bacterium looks like at a player's progress (#3194):
 * a Spore's cell is a plain, quiet capsule; each rank adds flagella, pili,
 * organelles, glow and life, up to a Superbug's. The rim light is the
 * player's colony colour.
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
  /** The membrane's colour (by rank) and the rim light's (the player's). */
  body: Rgb;
  rim: Rgb;
}

/** The rim's colour where no colony colour is given: the game's green. */
export const DEFAULT_PLAYER_RGB: ColonyRgb = [76, 175, 80];

const MAX_FLAGELLA = 6;
const MAX_PILI = 24;
const MAX_ORGANELLES = 8;

/** The membrane's colour from a Spore (first) to a Superbug (last). */
const BODIES: readonly Rgb[] = [
  [0.16, 0.42, 0.36],
  [0.12, 0.36, 0.48],
  [0.3, 0.2, 0.5],
  [0.48, 0.32, 0.1],
];

/**
 * The look a player's XP earns, its rim lit in `player`, their colony's
 * colour (0 to 255 a channel, as the arena's palette holds it).
 */
export function bacteriumLook(xp: number, player: ColonyRgb): BacteriumLook {
  const standing = rankFor(xp);
  const growth = Math.min(
    1,
    (standing.number - 1 + standing.progress) / (RANKS.length - 1)
  );
  return {
    growth,
    flagella: Math.round(growth * MAX_FLAGELLA),
    pili: growth < 0.2 ? 0 : Math.round(growth * MAX_PILI),
    organelles: 1 + Math.round(growth * (MAX_ORGANELLES - 1)),
    glow: 0.25 + 0.75 * growth,
    wobble: 0.012 + 0.03 * growth,
    body: blend(growth),
    rim: [player[0] / 255, player[1] / 255, player[2] / 255],
  };
}

/** The membrane's colour at `growth`, between its two nearest entries. */
function blend(growth: number): Rgb {
  const at = growth * (BODIES.length - 1);
  const low = BODIES[Math.floor(at)];
  const high = BODIES[Math.min(BODIES.length - 1, Math.floor(at) + 1)];
  return mixRgb(low, high, at - Math.floor(at));
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
