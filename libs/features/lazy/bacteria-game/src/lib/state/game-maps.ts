import { CLASSIC_MAPS, GameMap } from './maps';
import { ORGANIC_MAPS } from './organic-maps';

/** Every layout the game can be played on, in the order the levels use them. */
export const GAME_MAPS: readonly GameMap[] = [...CLASSIC_MAPS, ...ORGANIC_MAPS];

/** The map with that id, falling back to the corridors layout. */
export function getMap(id: string): GameMap {
  return GAME_MAPS.find((map) => map.id === id) ?? CLASSIC_MAPS[1];
}
