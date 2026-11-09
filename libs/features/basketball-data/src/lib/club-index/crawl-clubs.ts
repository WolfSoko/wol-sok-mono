import type { BasketballData } from '../basketball-data';
import {
  BasketballDataError,
  isBasketballDataError,
} from '../domain/basketball-data-error';
import type { LigaId, VerbandId, VereinId } from '../domain/ids';
import type { Liga } from '../domain/liga';
import {
  KEIN_LIGA_FILTER,
  naechsterStartIndex,
  type LigaSeite,
} from '../domain/liga-suche';
import type { Team } from '../domain/team';
import { byClubName, type ClubIndexEntry } from './club-index';

/** What a crawl takes beside the source and the Association. */
export interface ClubCrawlOptions {
  /** Clubs' own names an earlier crawl read; these are not read again. */
  readonly knownNames: ReadonlyMap<VereinId, string>;
  /** Waits before each read, so the source sees one request at a time, spaced. */
  readonly pause: () => Promise<void>;
  /**
   * Whether there is still time to read a Club's name; once not, a Team's
   * name stands in (`nameFromTeam`).
   */
  readonly timeForNames: () => boolean;
}

/**
 * Every Club playing in a League of `association`, each once, by name: its
 * Leagues page by page, each League's Teams, and the name of each Club no
 * earlier crawl read. Where that name cannot be read (in time), one of the
 * Club's Teams' names stands in, marked `nameFromTeam`. A League the
 * source does not know or cannot map is skipped; a League list or Teams
 * the source cannot deliver now reject, so the caller keeps what it had.
 * Waits `pause` before every read.
 */
export async function crawlClubs(
  data: BasketballData,
  association: VerbandId,
  options: ClubCrawlOptions
): Promise<readonly ClubIndexEntry[]> {
  const read: PacedRead = async (reading) => {
    await options.pause();
    return reading();
  };
  const leagues = await leaguesOf(data, association, read);
  const teamNames = new Map<VereinId, string>();
  for (const league of leagues) {
    for (const team of await teamsOf(data, league.id, read)) {
      if (!teamNames.has(team.vereinId)) {
        teamNames.set(team.vereinId, team.name);
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
  data: BasketballData,
  association: VerbandId,
  read: PacedRead
): Promise<readonly Liga[]> {
  const filter = { ...KEIN_LIGA_FILTER, verbandIds: [association] };
  let page: LigaSeite = (await read(() => data.ligaSuche(filter))).ersteSeite;
  const leagues = [...page.ligen];
  for (
    let start = naechsterStartIndex(page);
    start !== undefined;
    start = naechsterStartIndex(page)
  ) {
    const from = start;
    page = await read(() => data.ligaSeite(filter, from));
    if (page.ligen.length === 0 && page.weitere) {
      // the same page again would follow, and again
      throw new BasketballDataError(
        'unexpected-shape',
        `League list of ${association}: an empty page at ${from} with more to come`
      );
    }
    leagues.push(...page.ligen);
  }
  return leagues;
}

async function teamsOf(
  data: BasketballData,
  league: LigaId,
  read: PacedRead
): Promise<readonly Team[]> {
  try {
    return await read(() => data.ligaTeams(league));
  } catch (error) {
    if (
      isBasketballDataError(error, 'not-found') ||
      isBasketballDataError(error, 'unexpected-shape')
    ) {
      return [];
    }
    throw error;
  }
}

/** The Club's own name, or `undefined` where the source does not give it. */
async function clubName(
  data: BasketballData,
  club: VereinId,
  read: PacedRead
): Promise<string | undefined> {
  try {
    return (await read(() => data.vereinsTeams(club))).verein.name;
  } catch (error) {
    if (isBasketballDataError(error)) {
      return undefined;
    }
    throw error;
  }
}
