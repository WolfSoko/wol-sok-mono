import { isDecided, irregularityOf, compareTipOff, type Game } from './game';
import { nextGameIndex, type TeamSeason } from './team-season';

/** What the overview shows of one Team on a given day. */
export interface TeamOverview {
  /** The next Spiel to go to (`nextGame`). */
  readonly next?: Game;
  /**
   * The Spiele from today on before `next` (every one to come where
   * none is left) that fall through: cancelled or forfeited, so no one
   * drives to a Halle for nothing. Today's forfeit is `last` instead.
   */
  readonly cancellations: readonly Game[];
  /**
   * The last Spiel decided up to today, today's included: played with a
   * result, or forfeited.
   */
  readonly last?: Game;
}

/**
 * The overview of `season` on `today`. Relies on the date order of
 * `season.games`.
 *
 * @param today a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function teamOverview(season: TeamSeason, today: string): TeamOverview {
  const index = nextGameIndex(season, today);
  const next: Game | undefined = season.games[index];
  const untilNext = index === -1 ? season.games : season.games.slice(0, index);
  const last = season.games.findLast(
    (game) => game.date <= today && isDecided(game)
  );
  return {
    ...(next && { next }),
    cancellations: untilNext.filter(
      (game) =>
        game.date >= today &&
        game !== last &&
        irregularityOf(game) !== undefined
    ),
    ...(last && { last }),
  };
}

/**
 * `entries` by their next Spiel (`next` of each), the first to tip
 * off first (`compareTipOff`).
 * Entries without a next Spiel follow; ties keep the order given. Returns
 * a new list.
 */
export function byNextGame<T>(
  entries: readonly T[],
  next: (entry: T) => Game | undefined
): T[] {
  return [...entries].sort((a, b) => compareNext(next(a), next(b)));
}

function compareNext(a: Game | undefined, b: Game | undefined): number {
  if (a === undefined || b === undefined) {
    return Number(a === undefined) - Number(b === undefined);
  }
  return compareTipOff(a, b);
}

/** A Spiel with the Saison of the Team it is seen from. */
export interface SeasonGame {
  readonly season: TeamSeason;
  readonly game: Game;
}

/** A Team's Saison with its overview (`teamOverview`), as computed for it. */
export interface SeasonWithOverview {
  readonly season: TeamSeason;
  readonly overview: TeamOverview;
}

/**
 * What the overview shows of several Teams together, as of a Kind playing
 * in each: their `TeamOverview`s taken together, each Spiel with the
 * Saison it was seen in.
 */
export interface CombinedOverview {
  /** The first next Spiel of all the Teams (`compareTipOff`). */
  readonly next?: SeasonGame;
  /**
   * What falls through of each Team, as its own overview has it
   * (`TeamOverview.cancellations`), before `next` (all of it where none
   * is next), by tip-off.
   */
  readonly cancellations: readonly SeasonGame[];
  /**
   * What falls through of each Team after `next`, by tip-off: a
   * Team's own Ausfall can come after another Team's next Spiel.
   */
  readonly laterCancellations: readonly SeasonGame[];
  /** The latest last result of all the Teams. */
  readonly last?: SeasonGame;
}

/**
 * The overview of several Teams together, from each Team's own
 * `teamOverview`: the first next Spiel, every Spiel falling through
 * (before and after it, so a screen shows them in tip-off order) and the
 * latest result. A tie goes to the Team listed first.
 */
export function combinedOverview(
  teams: readonly SeasonWithOverview[]
): CombinedOverview {
  const gamesOf = (
    pick: (overview: TeamOverview) => readonly (Game | undefined)[]
  ): SeasonGame[] =>
    teams.flatMap(({ season, overview }) =>
      pick(overview)
        .filter((game): game is Game => game !== undefined)
        .map((game) => ({ season, game }))
    );
  const byTipOff = (a: SeasonGame, b: SeasonGame): number =>
    compareTipOff(a.game, b.game);
  const next = gamesOf(({ next: nextGame }) => [nextGame])
    .sort(byTipOff)
    .at(0);
  const last = gamesOf(({ last: lastGame }) => [lastGame])
    .sort((a, b) => byTipOff(b, a))
    .at(0);
  const allCancellations = gamesOf(({ cancellations }) => cancellations).sort(
    byTipOff
  );
  const beforeNext = (cancellation: SeasonGame): boolean =>
    next === undefined || byTipOff(cancellation, next) < 0;
  return {
    ...(next && { next }),
    cancellations: allCancellations.filter(beforeNext),
    laterCancellations: allCancellations.filter((a) => !beforeNext(a)),
    ...(last && { last }),
  };
}
