import type { Liga } from '@wolsok/feat-shared-basketball-data';

/** What tells Ligen of one name apart: `Regionsliga · Region Braunschweig`. */
export function ligaBeschreibung(liga: Liga): string {
  return [liga.spielklasse, liga.bezirk]
    .filter((teil) => teil !== undefined && teil !== '')
    .join(' · ');
}
