import type { League } from '@wolsok/feat-shared-basketball-data';

/** What tells Ligen of one name apart: `Regionsliga · Region Braunschweig`. */
export function ligaBeschreibung(liga: League): string {
  return [liga.division, liga.district]
    .filter((teil) => teil !== undefined && teil !== '')
    .join(' · ');
}
