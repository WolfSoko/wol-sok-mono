import type { BasketballData } from '../basketball-data';
import {
  BasketballDataError,
  isBasketballDataError,
} from '../domain/basketball-data-error';
import type { LeagueId, AssociationId, ClubId } from '../domain/ids';
import type { League } from '../domain/league';
import {
  NO_LEAGUE_FILTER,
  nextStartIndex,
  type LeaguePage,
} from '../domain/league-search';
import type { Team } from '../domain/team';
import { byClubName, type ClubIndexEntry } from './club-index';

/** The reads a crawl makes: the Leagues, their Teams and Clubs' names. */
export type ClubCrawlSource = Pick<
  BasketballData,
  'leagueSearch' | 'leaguePage' | 'leagueTeams' | 'club'
>;

/** What a crawl takes beside the source and the Association. */
export interface ClubCrawlOptions {
  /** Clubs' own names an earlier crawl read; these are not read again. */
  readonly knownNames: ReadonlyMap<ClubId, string>;
  /** Waits before each read, so the source sees one request at a time, spaced. */
  readonly pause: () => Promise<void>;
  /**
   * Whether there is still time to read a Club's name; once not, a Team's
   * name stands in (`nameFromTeam`).
   */
  readonly timeForNames: () => boolean;
}

/**
 * How often a crawl reads a Club's name before a failure that may pass (a
 * DBB error, a timeout) rejects it: one hiccup among hundreds of reads
 * should not cost the whole Association's crawl, which is due again only a
 * day later.
 */
export const CLUB_NAME_ATTEMPTS = 3;

/**
 * Every Club playing in a League of `association`, each once, by name: its
 * Leagues page by page, each League's Teams, and the name of each Club no
 * earlier crawl read. Where the source does not know or cannot map that
 * Club, or no time is left to read its name, one of the Club's Teams'
 * names stands in, marked `nameFromTeam`. A League the source does not
 * know or cannot map is skipped; a League list, Teams or a Club's name
 * (after `CLUB_NAME_ATTEMPTS` reads) the source cannot deliver now reject,
 * so the caller keeps what it had. Waits `pause` before every read.
 */
export async function crawlClubs(
  data: ClubCrawlSource,
  association: AssociationId,
  options: ClubCrawlOptions
): Promise<readonly ClubIndexEntry[]> {
  const read: PacedRead = async (reading) => {
    await options.pause();
    return reading();
  };
  const leagues = await leaguesOf(data, association, read);
  const teamNames = new Map<ClubId, string>();
  for (const league of leagues) {
    for (const team of await teamsOf(data, league.id, read)) {
      if (!teamNames.has(team.clubId)) {
        teamNames.set(team.clubId, team.name);
      }
    }
  }
  const clubs: ClubIndexEntry[] = [];
  for (const [id, teamName] of teamNames) {
    const name =
      options.knownNames.get(id) ??
      (options.timeForNames() ? await clubName(data, id, read) : undefined);
    clubs.push(
      name === undefined
        ? { id, name: teamName, nameFromTeam: true }
        : { id, name }
    );
  }
  return clubs.sort(byClubName);
}

type PacedRead = <T>(read: () => Promise<T>) => Promise<T>;

async function leaguesOf(
  data: ClubCrawlSource,
  association: AssociationId,
  read: PacedRead
): Promise<readonly League[]> {
  const filter = { ...NO_LEAGUE_FILTER, associationIds: [association] };
  let page: LeaguePage = (await read(() => data.leagueSearch(filter)))
    .firstPage;
  const leagues = [...page.leagues];
  for (
    let start = nextStartIndex(page);
    start !== undefined;
    start = nextStartIndex(page)
  ) {
    const from = start;
    page = await read(() => data.leaguePage(filter, from));
    if (page.leagues.length === 0 && page.more) {
      // the same page again would follow, and again
      throw new BasketballDataError(
        'unexpected-shape',
        `League list of ${association}: an empty page at ${from} with more to come`
      );
    }
    leagues.push(...page.leagues);
  }
  return leagues;
}

async function teamsOf(
  data: ClubCrawlSource,
  league: LeagueId,
  read: PacedRead
): Promise<readonly Team[]> {
  try {
    return await read(() => data.leagueTeams(league));
  } catch (error) {
    if (isLastingAnswer(error)) {
      return [];
    }
    throw error;
  }
}

/**
 * The Club's own name, or `undefined` where the source answered that it
 * does not know or cannot map it. A read that fails for the moment is made
 * again, up to `CLUB_NAME_ATTEMPTS` reads, each after the crawl's pause; then
 * it rejects, so no Team's name is stored for a name only missing for now
 * (#3017).
 */
async function clubName(
  data: ClubCrawlSource,
  club: ClubId,
  read: PacedRead
): Promise<string | undefined> {
  for (let attempt = 1; ; attempt++) {
    try {
      return (await read(() => data.club(club))).name;
    } catch (error) {
      if (isLastingAnswer(error)) {
        return undefined;
      }
      if (attempt >= CLUB_NAME_ATTEMPTS) {
        throw error;
      }
    }
  }
}

/**
 * Whether `error` is an answer trying again will not change: the source
 * does not know the thing, or answers in a shape this lib cannot read.
 */
function isLastingAnswer(error: unknown): boolean {
  return (
    isBasketballDataError(error, 'not-found') ||
    isBasketballDataError(error, 'unexpected-shape')
  );
}
