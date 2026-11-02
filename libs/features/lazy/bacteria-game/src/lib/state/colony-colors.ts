import type { game as gameTexts } from '../i18n/en/game';
import type { GameText } from '../i18n/game-text';
import { PlayerColorArray } from './player.model';

/** The id of a colony colour, as the dictionaries list it. */
export type ColonyColorId = keyof typeof gameTexts.colors;

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

/**
 * The grey of a neutral colony - no player's, and apart from every colour
 * a player can pick.
 */
export const NEUTRAL_COLOR: PlayerColorArray = [150, 156, 162, 255];

/** Orange on the left, blue on the right - the colours the game started with. */
export const DEFAULT_COLORS: readonly [string, string] = ['orange', 'blue'];

/** True for the id of a colour on offer. */
export function isColonyColorId(id: string): id is ColonyColorId {
  return COLONY_COLORS.some((color) => color.id === id);
}

/**
 * A colour's name as a text to translate - the first colour's for an id
 * not on offer, as {@link getColonyColor} falls back to it.
 */
export function colonyColorText(id: string): GameText {
  const known = isColonyColorId(id) ? id : 'orange';
  return { key: `game.colors.${known}` };
}

/** The colour with that id, falling back to the first one. */
export function getColonyColor(id: string): ColonyColor {
  return COLONY_COLORS.find((color) => color.id === id) ?? COLONY_COLORS[0];
}

/** True for the id of a colour on offer. */
export function isColonyColor(id: unknown): id is string {
  return COLONY_COLORS.some((color) => color.id === id);
}

/**
 * Black or white, whichever reads better on a colour - by the WCAG contrast
 * of each against it.
 */
export function readableOn([r, g, b]: readonly [
  number,
  number,
  number,
]): string {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? '#140a02'
    : '#ffffff';
}

/** The colour as the RGBA array a player is drawn with. */
export function toPlayerColor(color: ColonyColor): PlayerColorArray {
  return [color.rgb[0], color.rgb[1], color.rgb[2], 255];
}

/** True when both pairs hold the same colours in the same seats. */
export function sameColors(
  a: readonly [string, string],
  b: readonly [string, string]
): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * The value as a pair of two known, different colour ids - or null when it
 * is anything else, such as a stored value from an older version.
 */
export function validColorPair(value: unknown): [string, string] | null {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(isColonyColor) &&
    value[0] !== value[1]
  ) {
    return [value[0], value[1]];
  }
  return null;
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

/**
 * The colours of an online match, made by the host from both players'
 * picks: the host's own colour on the left, the guest's own on the right.
 * A guest who picked the host's colour plays its second one, which its pair
 * keeps apart from the first - so the two always differ. Until the guest's
 * picks are in, the host's pair stands.
 *
 * Only the host makes the pair; the guest plays the one it is sent, so both
 * devices spawn the same colours.
 */
export function onlineColors(
  host: readonly [string, string],
  guest: readonly [string, string] | null
): [string, string] {
  const own = validColorPair(host) ?? [DEFAULT_COLORS[0], DEFAULT_COLORS[1]];
  const theirs = validColorPair(guest);
  if (theirs === null) {
    return own;
  }
  return [own[0], theirs[0] !== own[0] ? theirs[0] : theirs[1]];
}

/**
 * The pair as one seat sees it: its own colour first, the other seat's
 * second.
 */
export function seatFirst(
  colors: readonly [string, string],
  seat: 0 | 1
): [string, string] {
  return seat === 0 ? [colors[0], colors[1]] : [colors[1], colors[0]];
}
