import {
  istEntschieden,
  sonderfallVon,
  vergleicheAnwurf,
  type Spiel,
} from './spiel';
import { naechstesSpielIndex, type TeamSaison } from './team-saison';

/** What the overview shows of one Team on a given day. */
export interface TeamUeberblick {
  /** The next Spiel to go to (`naechstesSpiel`). */
  readonly naechstes?: Spiel;
  /**
   * The Spiele from today on before `naechstes` (every one to come where
   * none is left) that fall through: cancelled or forfeited, so no one
   * drives to a Halle for nothing. Today's forfeit is `letztes` instead.
   */
  readonly ausfaelle: readonly Spiel[];
  /**
   * The last Spiel decided up to today, today's included: played with a
   * result, or forfeited.
   */
  readonly letztes?: Spiel;
}

/**
 * The overview of `saison` on `heute`. Relies on the date order of
 * `saison.spiele`.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`datumInDeutschland`)
 */
export function teamUeberblick(
  saison: TeamSaison,
  heute: string
): TeamUeberblick {
  const index = naechstesSpielIndex(saison, heute);
  const naechstes: Spiel | undefined = saison.spiele[index];
  const bisNaechstes =
    index === -1 ? saison.spiele : saison.spiele.slice(0, index);
  const letztes = saison.spiele.findLast(
    (spiel) => spiel.datum <= heute && istEntschieden(spiel)
  );
  return {
    ...(naechstes && { naechstes }),
    ausfaelle: bisNaechstes.filter(
      (spiel) =>
        spiel.datum >= heute &&
        spiel !== letztes &&
        sonderfallVon(spiel) !== undefined
    ),
    ...(letztes && { letztes }),
  };
}

/**
 * `eintraege` by their next Spiel (`naechstes` of each), the first to tip
 * off first (`vergleicheAnwurf`).
 * Entries without a next Spiel follow; ties keep the order given. Returns
 * a new list.
 */
export function nachNaechstemSpiel<T>(
  eintraege: readonly T[],
  naechstes: (eintrag: T) => Spiel | undefined
): T[] {
  return [...eintraege].sort((a, b) =>
    vergleicheNaechstes(naechstes(a), naechstes(b))
  );
}

function vergleicheNaechstes(
  a: Spiel | undefined,
  b: Spiel | undefined
): number {
  if (a === undefined || b === undefined) {
    return Number(a === undefined) - Number(b === undefined);
  }
  return vergleicheAnwurf(a, b);
}
