import { BASE_ARENA, scaleOf, scaleRect } from './arena-size';
import { CLASSIC_MAPS, GameMap, overlapsArena, Rect } from './maps';
import { ORGANIC_MAPS } from './organic-maps';

/**
 * The layout on an arena of any width: laid out on the base arena and grown
 * or shrunk with it, so a finer grid shows the same map with more cells.
 */
function scalable(map: GameMap): GameMap {
  return {
    ...map,
    createWalls: (width, height) =>
      scaled(width, height, (w, h) => map.createWalls(w, h)).filter(
        (wall) =>
          wall.width > 0 &&
          wall.height > 0 &&
          overlapsArena(wall, width, height)
      ),
    createDynamicWalls:
      map.createDynamicWalls == null
        ? undefined
        : (width, height, timeSec) =>
            scaled(
              width,
              height,
              (w, h) => map.createDynamicWalls?.(w, h, timeSec) ?? []
            ),
  };
}

/**
 * The walls `create` lays out on the base arena, scaled to an arena of that
 * size. A static wall the scaling leaves without a cell in the arena - too
 * thin for the grid, or a blob over the edge that no longer reaches in - is
 * dropped. The moving ones are all kept, even empty: they are told apart
 * from one frame to the next by their place in the list.
 */
function scaled<T extends Rect>(
  width: number,
  height: number,
  create: (width: number, height: number) => T[]
): T[] {
  const scale = scaleOf(width);
  if (scale === 1) {
    return create(width, height);
  }
  return create(BASE_ARENA.width, height / scale).map((wall) =>
    scaleRect(wall, scale)
  );
}

/** Every layout the game can be played on, in the order the levels use them. */
export const GAME_MAPS: readonly GameMap[] = [
  ...CLASSIC_MAPS,
  ...ORGANIC_MAPS,
].map(scalable);

/** The map with that id, falling back to the corridors layout. */
export function getMap(id: string): GameMap {
  return (
    GAME_MAPS.find((map) => map.id === id) ??
    (GAME_MAPS.find((map) => map.id === 'corridors') as GameMap)
  );
}
