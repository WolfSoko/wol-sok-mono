import { Rect } from './maps';

/**
 * The arena every layout, level and bot is designed for, in cells. 16:9, the
 * shape of most screens - the arena fills them with little left over.
 */
export const BASE_ARENA = { width: 320, height: 180 } as const;

/** How finely the simulation divides the arena into cells. */
export type SimResolution = 'low' | 'normal' | 'high' | 'ultra';

/** How many pixels the arena is drawn with. */
export type ScreenResolution = 'low' | 'medium' | 'high' | 'full-hd';

export interface ResolutionOption<T extends string> {
  id: T;
  name: string;
  /** For {@link SIM_RESOLUTIONS}: cells per base cell. Else: canvas width. */
  value: number;
}

/**
 * The grids the war can run on. A finer grid holds more, smaller bacteria -
 * the arena stays the same size, so the levels play alike on each of them,
 * but every step costs the processor more cells.
 */
export const SIM_RESOLUTIONS: readonly ResolutionOption<SimResolution>[] = [
  { id: 'low', name: 'Low', value: 0.8 },
  { id: 'normal', name: 'Normal', value: 1 },
  { id: 'high', name: 'High', value: 1.5 },
  { id: 'ultra', name: 'Ultra', value: 2 },
];

/** The canvas sizes the arena can be drawn at, by their width in pixels. */
export const SCREEN_RESOLUTIONS: readonly ResolutionOption<ScreenResolution>[] =
  [
    { id: 'low', name: '640p', value: 640 },
    { id: 'medium', name: '960p', value: 960 },
    { id: 'high', name: '1280p', value: 1280 },
    { id: 'full-hd', name: '1920p', value: 1920 },
  ];

export const DEFAULT_SIM_RESOLUTION: SimResolution = 'normal';
/**
 * The grid of an online match, whatever either device is set to: both run
 * the same grid, on the CPU, which holds 60 ticks a second at this one.
 */
export const ONLINE_SIM_RESOLUTION: SimResolution = 'normal';
export const DEFAULT_SCREEN_RESOLUTION: ScreenResolution = 'medium';

/** Cells per base cell on that grid. */
export function simScale(resolution: SimResolution): number {
  return option(SIM_RESOLUTIONS, resolution, DEFAULT_SIM_RESOLUTION).value;
}

/**
 * The arena in cells on that grid, for a map `size` times the base arena
 * along each side.
 */
export function arenaSize(
  resolution: SimResolution,
  size = 1
): {
  width: number;
  height: number;
} {
  const scale = simScale(resolution) * size;
  return {
    width: Math.round(BASE_ARENA.width * scale),
    height: Math.round(BASE_ARENA.height * scale),
  };
}

/**
 * The grid an arena that wide runs on, for a map `size` times the base
 * arena - a replay's, from its header. The online grid for a width no grid
 * has.
 */
export function simResolutionOf(width: number, size = 1): SimResolution {
  return (
    SIM_RESOLUTIONS.find(({ id }) => arenaSize(id, size).width === width)?.id ??
    ONLINE_SIM_RESOLUTION
  );
}

/** The widest a layer painted once - the zones - is, in pixels. */
const MAX_LAYER_WIDTH = 4096;

/**
 * Canvas pixels per arena cell with all of the arena in view, for that grid
 * drawn at that size. The canvas of a bigger map is as big as a base one's:
 * the camera shows part of it at a time, drawn as fine as a base map.
 */
export function renderScale(
  sim: SimResolution,
  screen: ScreenResolution,
  size = 1
): number {
  return canvasWidthOf(screen) / arenaSize(sim, size).width;
}

/**
 * Pixels per arena cell of the layers painted once, such as the zones: as
 * many as the canvas shows with the camera zoomed in all the way, up to a
 * width the GPU takes.
 */
export function detailScale(
  sim: SimResolution,
  screen: ScreenResolution,
  size = 1
): number {
  return (
    Math.min(canvasWidthOf(screen) * size, MAX_LAYER_WIDTH) /
    arenaSize(sim, size).width
  );
}

function canvasWidthOf(screen: ScreenResolution): number {
  return option(SCREEN_RESOLUTIONS, screen, DEFAULT_SCREEN_RESOLUTION).value;
}

/**
 * How far a moving wall may shove a bacterium before it crushes it: 3 cells
 * of the base arena, more on a finer grid, where a wall moves more cells.
 */
export function escapeReach(width: number, size = 1): number {
  return Math.max(3, Math.ceil(3 * scaleOf(width, size)));
}

/**
 * How many cells an arena of that width has per base cell - the grid's
 * resolution. A map `size` times the base arena has as many cells per base
 * cell as a base one on the same grid: it is bigger, not finer.
 */
export function scaleOf(width: number, size = 1): number {
  return width / (BASE_ARENA.width * size);
}

/**
 * The rect grown by that factor, on whole cells. Rounding half to even keeps
 * the edges of a rect and of its mirror image the same distance from the
 * centre on an arena of even size, so a point symmetric layout stays exactly
 * point symmetric. A rect too thin for the grid comes out empty.
 */
export function scaleRect<T extends Rect>(rect: T, scale: number): T {
  const x = roundHalfEven(rect.x * scale);
  const y = roundHalfEven(rect.y * scale);
  return {
    ...rect,
    x,
    y,
    width: roundHalfEven((rect.x + rect.width) * scale) - x,
    height: roundHalfEven((rect.y + rect.height) * scale) - y,
  };
}

function roundHalfEven(value: number): number {
  const rounded = Math.round(value);
  // Math.round sends every half up; send it to the even neighbour instead.
  return Math.abs(value % 1) === 0.5 && rounded % 2 !== 0
    ? rounded - 1
    : rounded;
}

function option<T extends string>(
  options: readonly ResolutionOption<T>[],
  id: T,
  fallback: T
): ResolutionOption<T> {
  return (
    options.find((candidate) => candidate.id === id) ??
    (options.find(
      (candidate) => candidate.id === fallback
    ) as ResolutionOption<T>)
  );
}
