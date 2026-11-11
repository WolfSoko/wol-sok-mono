import type { Venue } from './venue';
import type { League } from './league';
import type { LeagueId, GameId, TeamId } from './ids';
import { isTeam, type Participant } from './participant';

/** One side of a Spiel. */
export type GameSide = 'home' | 'away';

/** The points of both sides, of a whole Spiel or of one period. */
export interface Score {
  readonly home: number;
  readonly away: number;
}

/**
 * What became of a Spiel:
 * - `scheduled`: not played yet, or played without a result yet.
 * - `played`: played, with the result; `confirmed` once the Verband has
 *   confirmed it.
 * - `cancelled`: called off.
 * - `forfeited`: decided without being played, because a side gave it up
 *   (`forfeitedBy`: the sides that gave up, empty when the DBB names
 *   neither).
 */
export type GameStatus =
  | { readonly kind: 'scheduled' }
  | {
      readonly kind: 'played';
      readonly result: Score;
      readonly confirmed: boolean;
    }
  | { readonly kind: 'cancelled' }
  | {
      readonly kind: 'forfeited';
      readonly forfeitedBy: readonly GameSide[];
      readonly result?: Score;
    };

/** One game between two Teams within a Liga. */
export interface Game {
  readonly id: GameId;
  readonly leagueId: LeagueId;
  readonly matchday: number;
  /**
   * The German calendar day, `YYYY-MM-DD` (`dateInGermany`); a moved
   * Spiel carries its new day.
   */
  readonly date: string;
  /** The tip-off, `HH:mm`; absent where the DBB has none yet. */
  readonly time?: string;
  readonly home: Participant;
  readonly away: Participant;
  readonly status: GameStatus;
}

/** The DBB dates its Spiele by the German calendar day. */
const GERMAN_CALENDAR_DAY = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The German calendar day of `moment`, `YYYY-MM-DD`, as a Spiel's `date`.
 * Built from the parts, since a locale's own date pattern may change.
 */
export function dateInGermany(moment: Date): string {
  const parts = GERMAN_CALENDAR_DAY.formatToParts(moment);
  const part = (type: 'year' | 'month' | 'day'): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A Spiel with its Liga, Halle and the points of each period. */
export interface GameDetails {
  readonly game: Game;
  readonly league: League;
  readonly venue?: Venue;
  /** The four quarters' points, empty until the Spiel is recorded. */
  readonly quarters: readonly Score[];
  /** Each overtime's points, in order. */
  readonly overtimes: readonly Score[];
}

/** How a Spiel stands out of the plain schedule. */
export type GameIrregularity = 'cancelled' | 'forfeited';

/** The side `team` plays in `game`, or `undefined` where it plays none. */
export function sideOf(game: Game, team: TeamId): GameSide | undefined {
  if (isTeam(game.home, team)) {
    return 'home';
  }
  return isTeam(game.away, team) ? 'away' : undefined;
}

/** The side opposite `side`. */
export function otherSide(side: GameSide): GameSide {
  return side === 'home' ? 'away' : 'home';
}

/** Who plays against `side`. */
export function opponentOf(game: Game, side: GameSide): Participant {
  return game[otherSide(side)];
}

/** The final points of `game`, once there are any (a forfeit may have). */
export function resultOf(game: Game): Score | undefined {
  switch (game.status.kind) {
    case 'played':
    case 'forfeited':
      return game.status.result;
    case 'scheduled':
    case 'cancelled':
      return undefined;
  }
}

/** Whether `game` was called off or decided without being played. */
export function irregularityOf(game: Game): GameIrregularity | undefined {
  switch (game.status.kind) {
    case 'cancelled':
    case 'forfeited':
      return game.status.kind;
    case 'scheduled':
    case 'played':
      return undefined;
  }
}

/** How a decided Spiel ended for one side; basketball has no draws. */
export type GameOutcome = 'win' | 'loss';

/**
 * How `game` ended for `side`: by the points of a played Spiel, as the
 * score shows them (confirmed by the Verband or not yet); a forfeit goes to
 * the side that did not forfeit (both lose where both did), and one naming
 * no side by its points where it has any. None before a Spiel is decided,
 * or for equal points, which in basketball mean no result yet.
 */
export function outcomeOf(game: Game, side: GameSide): GameOutcome | undefined {
  const { status } = game;
  if (status.kind === 'forfeited' && status.forfeitedBy.length > 0) {
    return status.forfeitedBy.includes(side) ? 'loss' : 'win';
  }
  const result = resultOf(game);
  if (!result || result.home === result.away) {
    return undefined;
  }
  return result[side] > result[otherSide(side)] ? 'win' : 'loss';
}

/**
 * Whether the score of `game` is provisional: played, but not confirmed by
 * the Verband yet, so a correction may still change it (and the Sieg or
 * Niederlage read from it). A forfeit carries no confirmation and counts as
 * none, and neither does a Spiel of a `league` whose results the DBB never
 * confirms (`resultsNeverConfirmed`). Without its Liga (`undefined`) only the
 * Spiel decides.
 */
export function resultProvisional(
  game: Game,
  league: League | undefined
): boolean {
  return (
    game.status.kind === 'played' &&
    !game.status.confirmed &&
    !league?.resultsNeverConfirmed
  );
}

/** Whether `game` is decided: played with a result, or forfeited. */
export function isDecided(game: Game): boolean {
  return game.status.kind === 'played' || game.status.kind === 'forfeited';
}

/**
 * Sorts after every `HH:mm`: a Spiel without a tip-off is one the Liga has
 * yet to time, so the known tip-offs of its day come first.
 */
const WITHOUT_TIME = '~';

/**
 * Orders Spiele by day, then tip-off, a Spiel without a tip-off last on
 * its day; Spiele of one tip-off tie (0), so a stable sort keeps their
 * order.
 */
export function compareTipOff(a: Game, b: Game): number {
  const [first, second] = [tipOff(a), tipOff(b)];
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
}

function tipOff(game: Game): string {
  return `${game.date} ${game.time ?? WITHOUT_TIME}`;
}
