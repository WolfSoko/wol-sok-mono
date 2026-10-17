import { PlayerColorArray } from './player.model';

/** A colour a player can give their colony. */
export interface ColonyColor {
  /** Stable id, stored in the game state and in the settings. */
  id: string;
  /** Shown in the picker, and as the player's name in a two player match. */
  name: string;
  rgb: readonly [number, number, number];
}

/**
 * The colours on offer. All of them are bright and saturated, so a colony
 * stands out against the dark floor of every level.
 */
export const COLONY_COLORS: readonly ColonyColor[] = [
  { id: 'orange', name: 'Orange', rgb: [255, 100, 20] },
  { id: 'blue', name: 'Blue', rgb: [0, 100, 230] },
  { id: 'green', name: 'Green', rgb: [40, 200, 70] },
  { id: 'pink', name: 'Pink', rgb: [255, 70, 170] },
  { id: 'purple', name: 'Purple', rgb: [150, 80, 255] },
  { id: 'yellow', name: 'Yellow', rgb: [240, 210, 30] },
  { id: 'cyan', name: 'Cyan', rgb: [0, 210, 220] },
  { id: 'red', name: 'Red', rgb: [230, 40, 40] },
];

/** Orange on the left, blue on the right - the colours the game started with. */
export const DEFAULT_COLORS: readonly [string, string] = ['orange', 'blue'];

/** The colour with that id, falling back to the first one. */
export function getColonyColor(id: string): ColonyColor {
  return COLONY_COLORS.find((color) => color.id === id) ?? COLONY_COLORS[0];
}

/** True for the id of a colour on offer. */
export function isColonyColor(id: unknown): id is string {
  return COLONY_COLORS.some((color) => color.id === id);
}

/** The colour as the RGBA array a player is drawn with. */
export function toPlayerColor(color: ColonyColor): PlayerColorArray {
  return [color.rgb[0], color.rgb[1], color.rgb[2], 255];
}

/**
 * The seats' colours after one seat picked a new one. Two colonies in the
 * same colour could not be told apart, so a seat that picks the other
 * seat's colour swaps with it.
 */
export function pickColor(
  colors: readonly [string, string],
  seat: 0 | 1,
  colorId: string
): [string, string] {
  const other = seat === 0 ? 1 : 0;
  const next: [string, string] = [colors[0], colors[1]];
  if (colors[other] === colorId) {
    next[other] = colors[seat];
  }
  next[seat] = colorId;
  return next;
}
