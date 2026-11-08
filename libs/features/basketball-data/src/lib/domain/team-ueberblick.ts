import { sonderfallVon, type Spiel } from './spiel';
import { naechstesSpiel, type TeamSaison } from './team-saison';

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
  const naechstes = naechstesSpiel(saison, heute);
  const bisNaechstes =
    naechstes === undefined
      ? saison.spiele
      : saison.spiele.slice(0, saison.spiele.indexOf(naechstes));
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
 * off first; on one day a Spiel without a time comes after the timed ones.
 * Entries without a next Spiel follow; ties keep the order given. Returns
 * a new list.
 */
export function nachNaechstemSpiel<T>(
  eintraege: readonly T[],
  naechstes: (eintrag: T) => Spiel | undefined
): T[] {
  return [...eintraege].sort((a, b) =>
    vergleicheAnpfiff(naechstes(a), naechstes(b))
  );
}

/** Sorts after every `HH:mm`, so a Spiel without a time ends its day. */
const OHNE_UHRZEIT = '~';

function anpfiff(spiel: Spiel): string {
  return `${spiel.datum} ${spiel.uhrzeit ?? OHNE_UHRZEIT}`;
}

function vergleicheAnpfiff(a: Spiel | undefined, b: Spiel | undefined): number {
  if (a === undefined || b === undefined) {
    return Number(a === undefined) - Number(b === undefined);
  }
  const [erster, zweiter] = [anpfiff(a), anpfiff(b)];
  if (erster === zweiter) {
    return 0;
  }
  return erster < zweiter ? -1 : 1;
}

function istEntschieden(spiel: Spiel): boolean {
  return spiel.status.art === 'gespielt' || spiel.status.art === 'kampflos';
}
