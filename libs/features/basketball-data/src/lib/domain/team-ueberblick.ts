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

/** A Spiel with the Saison of the Team it is seen from. */
export interface SaisonSpiel {
  readonly saison: TeamSaison;
  readonly spiel: Spiel;
}

/** A Team's Saison with its overview (`teamUeberblick`), as computed for it. */
export interface SaisonMitUeberblick {
  readonly saison: TeamSaison;
  readonly ueberblick: TeamUeberblick;
}

/**
 * What the overview shows of several Teams together, as of a Kind playing
 * in each: their `TeamUeberblick`s taken together, each Spiel with the
 * Saison it was seen in.
 */
export interface GemeinsamerUeberblick {
  /** The first next Spiel of all the Teams (`vergleicheAnwurf`). */
  readonly naechstes?: SaisonSpiel;
  /**
   * What falls through of each Team, as its own overview has it
   * (`TeamUeberblick.ausfaelle`), before `naechstes` (all of it where none
   * is next), by tip-off.
   */
  readonly ausfaelle: readonly SaisonSpiel[];
  /**
   * What falls through of each Team after `naechstes`, by tip-off: a
   * Team's own Ausfall can come after another Team's next Spiel.
   */
  readonly spaetereAusfaelle: readonly SaisonSpiel[];
  /** The latest last result of all the Teams. */
  readonly letztes?: SaisonSpiel;
}

/**
 * The overview of several Teams together, from each Team's own
 * `teamUeberblick`: the first next Spiel, every Spiel falling through
 * (before and after it, so a screen shows them in tip-off order) and the
 * latest result. A tie goes to the Team listed first.
 */
export function gemeinsamerUeberblick(
  teams: readonly SaisonMitUeberblick[]
): GemeinsamerUeberblick {
  const mit = (
    wahl: (ueberblick: TeamUeberblick) => readonly (Spiel | undefined)[]
  ): SaisonSpiel[] =>
    teams.flatMap(({ saison, ueberblick }) =>
      wahl(ueberblick)
        .filter((spiel): spiel is Spiel => spiel !== undefined)
        .map((spiel) => ({ saison, spiel }))
    );
  const nachAnwurf = (a: SaisonSpiel, b: SaisonSpiel): number =>
    vergleicheAnwurf(a.spiel, b.spiel);
  const naechstes = mit(({ naechstes }) => [naechstes])
    .sort(nachAnwurf)
    .at(0);
  const letztes = mit(({ letztes }) => [letztes])
    .sort((a, b) => nachAnwurf(b, a))
    .at(0);
  const alleAusfaelle = mit(({ ausfaelle }) => ausfaelle).sort(nachAnwurf);
  const vorNaechstem = (ausfall: SaisonSpiel): boolean =>
    naechstes === undefined || nachAnwurf(ausfall, naechstes) < 0;
  return {
    ...(naechstes && { naechstes }),
    ausfaelle: alleAusfaelle.filter(vorNaechstem),
    spaetereAusfaelle: alleAusfaelle.filter((a) => !vorNaechstem(a)),
    ...(letztes && { letztes }),
  };
}
