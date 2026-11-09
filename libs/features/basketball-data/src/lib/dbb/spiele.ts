import type { Liga } from '../domain/liga';
import { vergleicheAnwurf, type Spiel } from '../domain/spiel';
import type { DbbObject } from './dbb-object';
import { mapLiga } from './map-liga';
import { mapSpiel } from './map-spiel';

/** A Spiel with the Liga its match object carries. */
export interface SpielInLiga {
  readonly spiel: Spiel;
  readonly liga: Liga;
}

/** The Spiele of match objects that carry their `ligaData`, as Team and Verein lists do. */
export function mapSpieleInLigen(
  matches: readonly DbbObject[]
): readonly SpielInLiga[] {
  return matches.map((match) => ({
    spiel: mapSpiel(match),
    liga: mapLiga(match.object('ligaData')),
  }));
}

/** Each Spiel once, by date and tip-off. */
export function chronologisch<T extends { readonly spiel: Spiel }>(
  eintraege: readonly T[]
): readonly T[] {
  const byId = new Map<number, T>();
  for (const eintrag of eintraege) {
    byId.set(eintrag.spiel.id, eintrag);
  }
  return [...byId.values()].sort(
    (a, b) => vergleicheAnwurf(a.spiel, b.spiel) || a.spiel.id - b.spiel.id
  );
}

/** Each Liga once, in the order given. */
export function distinctLigen(ligen: readonly Liga[]): readonly Liga[] {
  return [...new Map(ligen.map((liga) => [liga.id, liga] as const)).values()];
}
