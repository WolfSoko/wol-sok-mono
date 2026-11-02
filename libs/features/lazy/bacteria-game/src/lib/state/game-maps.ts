import { BASE_ARENA, scaleOf, scaleRect } from './arena-size';
import { CLASSIC_MAPS, GameMap, overlapsArena, Rect } from './maps';
import { generatedLevel } from './level-generator/generate-level';
import { ORGANIC_MAPS } from './organic-maps';
import { mapZones } from './zones';
import { OUTBREAK_MAPS } from './outbreak-maps';
import { EXPANSE_MAPS } from './expanse-maps';
import { REACTOR_MAPS } from './reactor-maps';
import { TRAINING_MAPS } from './training-levels';

/**
 * The layout on an arena of any width: laid out on the base arena and grown
 * or shrunk with it, so a finer grid shows the same map with more cells.
 */
function scalable(map: GameMap): GameMap {
  return {
    ...map,
    createWalls: (width, height) =>
      scaled(map, width, height, (w, h) => map.createWalls(w, h)).filter(
        (wall) => hasCells(wall, width, height)
      ),
    createZones:
      map.createZones == null
        ? undefined
        : (width, height) =>
            scaled(map, width, height, (w, h) => mapZones(map, w, h)).filter(
              (zone) => hasCells(zone, width, height)
            ),
    createDynamicWalls:
      map.createDynamicWalls == null
        ? undefined
        : (width, height, timeSec) =>
            scaled(
              map,
              width,
              height,
              (w, h) => map.createDynamicWalls?.(w, h, timeSec) ?? []
            ),
  };
}

/** True for a rect the scaling left with a cell in the arena. */
function hasCells(rect: Rect, width: number, height: number): boolean {
  return (
    rect.width > 0 && rect.height > 0 && overlapsArena(rect, width, height)
  );
}

/**
 * The walls `create` lays out on the map's base arena - the base one times
 * its size - scaled to an arena of that size. A static wall the scaling leaves without a cell in the arena - too
 * thin for the grid, or a blob over the edge that no longer reaches in - is
 * dropped. The moving ones are all kept, even empty: they are told apart
 * from one frame to the next by their place in the list.
 */
function scaled<T extends Rect>(
  map: GameMap,
  width: number,
  height: number,
  create: (width: number, height: number) => T[]
): T[] {
  const size = map.size ?? 1;
  const scale = scaleOf(width, size);
  if (scale === 1) {
    return create(width, height);
  }
  return create(BASE_ARENA.width * size, height / scale).map((wall) =>
    scaleRect(wall, scale)
  );
}

/** Every layout the game can be played on, in the order the levels use them. */
export const GAME_MAPS: readonly GameMap[] = [
  ...CLASSIC_MAPS,
  ...ORGANIC_MAPS,
  ...REACTOR_MAPS,
  ...OUTBREAK_MAPS,
  ...EXPANSE_MAPS,
  ...TRAINING_MAPS,
].map(scalable);

const CORRIDORS = GAME_MAPS.find((map) => map.id === 'corridors') as GameMap;

/**
 * The map with that id - a hand-made one, or a generated one for a `gen:`
 * id - falling back to the corridors layout.
 */
export function getMap(id: string): GameMap {
  const handMade = GAME_MAPS.find((map) => map.id === id);
  if (handMade !== undefined) {
    return handMade;
  }
  // The generator keeps the layouts: the wrapper only scales them.
  const made = generatedLevel(id)?.map;
  return made === undefined ? CORRIDORS : scalable(made);
}
