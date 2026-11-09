import type { Halle } from './halle';
import type { Liga } from './liga';
import type { LigaId, SpielId, TeamId } from './ids';
import { istTeam, type SpielPartei } from './partei';

/** One side of a Spiel. */
export type SpielSeite = 'heim' | 'gast';

/** The points of both sides, of a whole Spiel or of one period. */
export interface Spielstand {
  readonly heim: number;
  readonly gast: number;
}

/**
 * What became of a Spiel:
 * - `geplant`: not played yet, or played without a result yet.
 * - `gespielt`: played, with the result; `bestaetigt` once the Verband has
 *   confirmed it.
 * - `abgesagt`: called off.
 * - `kampflos`: decided without being played, because a side gave it up
 *   (`verzichtet`: the sides that gave up, empty when the DBB names
 *   neither).
 */
export type SpielStatus =
  | { readonly art: 'geplant' }
  | {
      readonly art: 'gespielt';
      readonly ergebnis: Spielstand;
      readonly bestaetigt: boolean;
    }
  | { readonly art: 'abgesagt' }
  | {
      readonly art: 'kampflos';
      readonly verzichtet: readonly SpielSeite[];
      readonly ergebnis?: Spielstand;
    };

/** One game between two Teams within a Liga. */
export interface Spiel {
  readonly id: SpielId;
  readonly ligaId: LigaId;
  readonly spieltag: number;
  /**
   * The German calendar day, `YYYY-MM-DD` (`datumInDeutschland`); a moved
   * Spiel carries its new day.
   */
  readonly datum: string;
  /** The tip-off, `HH:mm`; absent where the DBB has none yet. */
  readonly uhrzeit?: string;
  readonly heim: SpielPartei;
  readonly gast: SpielPartei;
  readonly status: SpielStatus;
}

/** The DBB dates its Spiele by the German calendar day. */
const DEUTSCHER_KALENDERTAG = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The German calendar day of `moment`, `YYYY-MM-DD`, as a Spiel's `datum`.
 * Built from the parts, since a locale's own date pattern may change.
 */
export function datumInDeutschland(moment: Date): string {
  const parts = DEUTSCHER_KALENDERTAG.formatToParts(moment);
  const part = (type: 'year' | 'month' | 'day'): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A Spiel with its Liga, Halle and the points of each period. */
export interface SpielDetails {
  readonly spiel: Spiel;
  readonly liga: Liga;
  readonly halle?: Halle;
  /** The four quarters' points, empty until the Spiel is recorded. */
  readonly viertel: readonly Spielstand[];
  /** Each overtime's points, in order. */
  readonly verlaengerungen: readonly Spielstand[];
}

/** How a Spiel stands out of the plain schedule. */
export type SpielSonderfall = 'abgesagt' | 'kampflos';

/** The side `team` plays in `spiel`, or `undefined` where it plays none. */
export function seiteVon(spiel: Spiel, team: TeamId): SpielSeite | undefined {
  if (istTeam(spiel.heim, team)) {
    return 'heim';
  }
  return istTeam(spiel.gast, team) ? 'gast' : undefined;
}

/** The side opposite `seite`. */
export function andereSeite(seite: SpielSeite): SpielSeite {
  return seite === 'heim' ? 'gast' : 'heim';
}

/** Who plays against `seite`. */
export function gegnerVon(spiel: Spiel, seite: SpielSeite): SpielPartei {
  return spiel[andereSeite(seite)];
}

/** The final points of `spiel`, once there are any (a forfeit may have). */
export function ergebnisVon(spiel: Spiel): Spielstand | undefined {
  switch (spiel.status.art) {
    case 'gespielt':
    case 'kampflos':
      return spiel.status.ergebnis;
    case 'geplant':
    case 'abgesagt':
      return undefined;
  }
}

/** Whether `spiel` was called off or decided without being played. */
export function sonderfallVon(spiel: Spiel): SpielSonderfall | undefined {
  switch (spiel.status.art) {
    case 'abgesagt':
    case 'kampflos':
      return spiel.status.art;
    case 'geplant':
    case 'gespielt':
      return undefined;
  }
}

/** How a decided Spiel ended for one side; basketball has no draws. */
export type SpielAusgang = 'sieg' | 'niederlage';

/**
 * How `spiel` ended for `seite`: by the points of a played Spiel, as the
 * score shows them (confirmed by the Verband or not yet); a forfeit goes to
 * the side that did not forfeit (both lose where both did), and one naming
 * no side by its points where it has any. None before a Spiel is decided,
 * or for equal points, which in basketball mean no result yet.
 */
export function ausgangVon(
  spiel: Spiel,
  seite: SpielSeite
): SpielAusgang | undefined {
  const { status } = spiel;
  if (status.art === 'kampflos' && status.verzichtet.length > 0) {
    return status.verzichtet.includes(seite) ? 'niederlage' : 'sieg';
  }
  const ergebnis = ergebnisVon(spiel);
  if (!ergebnis || ergebnis.heim === ergebnis.gast) {
    return undefined;
  }
  return ergebnis[seite] > ergebnis[andereSeite(seite)] ? 'sieg' : 'niederlage';
}

/**
 * Whether the score of `spiel` is provisional: played, but not confirmed by
 * the Verband yet, so a correction may still change it (and the Sieg or
 * Niederlage read from it). A forfeit carries no confirmation and counts as
 * none.
 */
export function ergebnisVorlaeufig(spiel: Spiel): boolean {
  return spiel.status.art === 'gespielt' && !spiel.status.bestaetigt;
}

/** Whether `spiel` is decided: played with a result, or forfeited. */
export function istEntschieden(spiel: Spiel): boolean {
  return spiel.status.art === 'gespielt' || spiel.status.art === 'kampflos';
}

/**
 * Sorts after every `HH:mm`: a Spiel without a tip-off is one the Liga has
 * yet to time, so the known tip-offs of its day come first.
 */
const OHNE_UHRZEIT = '~';

/**
 * Orders Spiele by day, then tip-off, a Spiel without a tip-off last on
 * its day; Spiele of one tip-off tie (0), so a stable sort keeps their
 * order.
 */
export function vergleicheAnwurf(a: Spiel, b: Spiel): number {
  const [erster, zweiter] = [anwurf(a), anwurf(b)];
  if (erster === zweiter) {
    return 0;
  }
  return erster < zweiter ? -1 : 1;
}

function anwurf(spiel: Spiel): string {
  return `${spiel.datum} ${spiel.uhrzeit ?? OHNE_UHRZEIT}`;
}
