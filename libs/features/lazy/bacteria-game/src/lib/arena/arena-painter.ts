import { BacteriaLook } from '../settings.service';
import { Nutrient } from '../state/bacteria-simulation';
import { GameBalance } from '../state/game-balance';
import { DynamicWall, Rect } from '../state/maps';
import { ArenaTheme } from './arena-theme';
import { ColonyLayer } from './colony-renderer';

/** A player's crosshair as it is drawn. */
export interface CursorShape {
  x: number;
  y: number;
  /** RGBA, the alpha from 0 to 255. */
  color: readonly number[];
  /** How much of a running boost is left, 0 to 1 - null without a boost. */
  boostLeft: number | null;
}

/** Everything one frame of the arena shows, in arena cells. */
export interface ArenaFrame {
  /** Paint the floor fully instead of fading the last frame into a trail. */
  clear: boolean;
  /** Seconds since the last frame - moves the drifting specks. */
  deltaTimeSec: number;
  /** Seconds of animation - the jam wobble and the boost shimmer. */
  timeSec: number;
  walls: readonly Rect[];
  dynamicWalls: readonly DynamicWall[];
  colonies: readonly ColonyLayer[];
  /** Leave out what flickers - the player asked their system for less motion. */
  reducedMotion: boolean;
  nutrients: readonly Nutrient[];
  balance: GameBalance;
  look: BacteriaLook;
  cursors: readonly CursorShape[];
}

/**
 * Draws the arena onto its canvas. There are two: one on the GPU through
 * WebGL2, and the Canvas 2D one for browsers without it.
 */
export interface ArenaPainter {
  readonly kind: 'webgl' | 'canvas';
  /** Switches to another level's look. */
  setTheme(theme: ArenaTheme): void;
  paint(frame: ArenaFrame): void;
  /** Lets go of what the painter holds on the canvas - it is done drawing. */
  dispose(): void;
}

/** The radius of the ring around a boosted crosshair - it widens as the boost runs out. */
export function boostRingRadius(boostLeft: number): number {
  return 9 + 4 * (1 - boostLeft);
}
