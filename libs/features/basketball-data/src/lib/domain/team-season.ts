import type { LeagueId } from './ids';
import type { League } from './league';
import type { Game } from './game';
import type { Team } from './team';
import type { Club } from './club';

/**
 * A Team's whole Saison: every Spiel in every Liga it plays in (a Vorrunde,
 * then a Hauptrunde), in one list by date.
 */
export interface TeamSeason {
  readonly team: Team;
  readonly club: Club;
  /** The Ligen of `games`, in the order they first play. */
  readonly leagues: readonly League[];
  readonly games: readonly Game[];
}

/** A Team seen in a Verein's recent Spiele, with the Ligen it played in. */
export interface ClubTeam {
  readonly team: Team;
  readonly leagues: readonly League[];
}

/** A Verein with the Teams seen in its recent Spiele, by name. */
export interface ClubTeams {
  readonly club: Club;
  readonly teams: readonly ClubTeam[];
}

/** The Liga `leagueId` of `season`, if the Team plays in it. */
export function leagueOf(
  season: TeamSeason,
  leagueId: LeagueId
): League | undefined {
  return season.leagues.find(({ id }) => id === leagueId);
}

/**
 * The Team's next Spiel to go to, from `today` on (today's included): the
 * first still to be played (`scheduled`). It passes over a cancelled
 * (`cancelled`) Spiel, one played already (`played`, today's too once its
 * result is in) and a forfeited (`forfeited`) one, with or without a
 * result, since none of them is played. Relies on the date order of
 * `season.games`.
 *
 * @param today a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function nextGame(season: TeamSeason, today: string): Game | undefined {
  return season.games[nextGameIndex(season, today)];
}

/** Where `nextGame` stands in `season.games`; -1 where none is left. */
export function nextGameIndex(season: TeamSeason, today: string): number {
  return season.games.findIndex(
    ({ date, status }) => date >= today && status.kind === 'scheduled'
  );
}

/**
 * The Spiele of `season` played up to `today` (today's included), newest
 * first, at most `atMost`: those with a Spielbericht to look into.
 * Cancelled and forfeited Spiele have none; a result the DBB lists ahead of
 * its day is passed over, as `teamOverview` does. Relies on the date
 * order of `season.games`.
 *
 * @param today a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function lastPlayed(
  season: TeamSeason,
  today: string,
  atMost: number
): readonly Game[] {
  return season.games
    .filter(({ date, status }) => date <= today && status.kind === 'played')
    .reverse()
    .slice(0, atMost);
}

/**
 * Whether the DBB keeps a Spielbericht for `game`, a Spiel of `season`: not
 * where its Liga is `withoutGameReports`, so its page has no Kader. A Liga
 * the Saison does not list counts as keeping them, as nothing says
 * otherwise.
 */
export function keepsGameReports(season: TeamSeason, game: Game): boolean {
  return !leagueOf(season, game.leagueId)?.withoutGameReports;
}

/**
 * The last Spiel of `season` played up to `today` (today's included) that
 * the DBB keeps a Spielbericht for (`keepsGameReports`): the newest whose
 * Kader names its players. Passes over cancelled and forfeited Spiele as
 * `lastPlayed` does.
 *
 * @param today a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function lastWithGameReport(
  season: TeamSeason,
  today: string
): Game | undefined {
  return season.games.findLast(
    (game) =>
      game.date <= today &&
      game.status.kind === 'played' &&
      keepsGameReports(season, game)
  );
}

/** How many days after its last Spiel a Team's Saison counts as over. */
const SEASON_OVER_AFTER_DAYS = 14;

/**
 * Whether the Team's Saison looks over on `today`: no Spiel left to go to
 * (`nextGame`) and its last Spiel more than two weeks
 * (`SEASON_OVER_AFTER_DAYS`) past. A long break looks the same (between a
 * Vorrunde and a Hauptrunde not yet scheduled, over the holidays), so a
 * screen asks rather than claims. Relies on the date order of
 * `season.games`.
 *
 * @param today a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function seasonOver(season: TeamSeason, today: string): boolean {
  const last = season.games.at(-1);
  return (
    last !== undefined &&
    nextGameIndex(season, today) === -1 &&
    daysBetween(last.date, today) > SEASON_OVER_AFTER_DAYS
  );
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The calendar days from `from` to `to`, both `YYYY-MM-DD`. */
function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_DAY;
}

/**
 * The Ligen of `season`, the current one first: the Liga of the first Spiel
 * not cancelled from `today` on, played or forfeited ones included, since
 * their results count in the Liga's Tabelle (so on match day the Liga of
 * today's Spiel stays first once it is played); or of the last Spiel not
 * cancelled once none is left (of the last Spiel where all are). A
 * Hauptrunde takes over with its first Spiel to come; a Vorrunde with a
 * Spiel still ahead stays first. The other Ligen follow by their last
 * Spiel, newest first.
 */
export function leaguesCurrentFirst(
  season: TeamSeason,
  today: string
): readonly League[] {
  const current = currentGame(season, today);
  if (current === undefined) {
    return [];
  }
  const newestFirst = [...season.games]
    .reverse()
    .map(({ leagueId }) => leagueId);
  return [...new Set<LeagueId>([current.leagueId, ...newestFirst])]
    .map((id) => leagueOf(season, id))
    .filter((league): league is League => league !== undefined);
}

/**
 * The Spiel whose Liga is the current one (`leaguesCurrentFirst`): the
 * first not cancelled from `today` on, else the last not cancelled, else
 * the last of all.
 */
function currentGame(season: TeamSeason, today: string): Game | undefined {
  const takingPlace = gamesTakingPlace(season);
  return (
    takingPlace.find(({ date }) => date >= today) ??
    takingPlace.at(-1) ??
    season.games.at(-1)
  );
}

function gamesTakingPlace(season: TeamSeason): readonly Game[] {
  return season.games.filter(({ status }) => status.kind !== 'cancelled');
}
