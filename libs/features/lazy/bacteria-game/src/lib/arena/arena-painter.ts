import type { GpuTimer } from '../gl/gpu-timer';
import type { DishAmbience } from './ambience';
import { Nutrient } from '../state/bacteria-simulation';
import type { ActiveEffect, WeaponFire } from '../state/evolution';
import { GameBalance } from '../state/game-balance';
import { DynamicWall, Rect } from '../state/maps';
import { Zone } from '../state/zones';
import { ArenaTheme } from './arena-theme';
import type { PaintedColony } from './colony-renderer';

export type { PaintedColony } from './colony-renderer';

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
  /**
   * The part of the arena the canvas shows, in cells - all of it, but on a
   * map bigger than the base arena, where the camera picks it.
   */
  view: Rect;
  walls: readonly Rect[];
  dynamicWalls: readonly DynamicWall[];
  colonies: readonly PaintedColony[];
  /** Leave out what flickers - the player asked their system for less motion. */
  reducedMotion: boolean;
  nutrients: readonly Nutrient[];
  balance: GameBalance;
  cursors: readonly CursorShape[];
  /** The weapons fired since the last frame - each bursts out now. */
  weaponFires: readonly WeaponFire[];
  /** The weapons' effects acting on the war now. */
  weaponEffects: readonly ActiveEffect[];
  /** Each seat's colony colour, RGBA - whose effect is whose. */
  seatColors: ReadonlyMap<number, readonly number[]>;
  /** How many particles the weapons' effects may fly at once. */
  particleBudget: number;
  /**
   * The dish's bubbles, mist and depth, for a painter that draws them with
   * the arena ({@link ArenaPainter.paintsAmbience}) - null or absent where
   * they are off.
   */
  ambience?: DishAmbience | null;
}

/**
 * Draws the arena onto its canvas. There are two: one on the GPU through
 * WebGL2, and the Canvas 2D one for browsers without it.
 */
export interface ArenaPainter {
  readonly kind: 'webgl' | 'canvas';
  /**
   * True for a painter that draws the frame's ambience itself, over the
   * arena - the WebGL one. For any other, the stage lays it on a canvas of
   * its own.
   */
  readonly paintsAmbience?: boolean;
  /**
   * Lays another level's floor: its look, and its zones painted into it -
   * they never move, so they are not drawn again every frame.
   */
  setFloor(theme: ArenaTheme, zones: readonly Zone[]): void;
  paint(frame: ArenaFrame): void;
  /**
   * Puts the last painted frame on the canvas again. A WebGL canvas lets go
   * of it once the browser has shown it - a snapshot of the canvas taken
   * right after this call, in the same task, sees the arena.
   */
  showLastFrame(): void;
  /**
   * Times the GPU's work for the HUD's breakdown of a frame - made on the
   * first call; null where the painter has no GPU or it cannot be timed.
   */
  gpuTimer?(): GpuTimer | null;
  /** Lets go of what the painter holds on the canvas - it is done drawing. */
  dispose(): void;
}

/**
 * The two bars of a crosshair, in arena cells, `unit` cells per base cell so
 * it is as big on every grid.
 */
export function crosshairBars(cursor: CursorShape, unit: number): [Rect, Rect] {
  return [
    {
      x: cursor.x - 6 * unit,
      y: cursor.y - 0.5 * unit,
      width: 13 * unit,
      height: 2 * unit,
    },
    {
      x: cursor.x - 0.5 * unit,
      y: cursor.y - 6 * unit,
      width: 2 * unit,
      height: 13 * unit,
    },
  ];
}

/** The radius of the ring around a boosted crosshair - it widens as the boost runs out. */
export function boostRingRadius(boostLeft: number): number {
  return 9 + 4 * (1 - boostLeft);
}
