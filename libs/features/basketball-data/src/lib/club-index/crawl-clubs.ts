import type { BasketballData } from '../basketball-data';
import { isBasketballDataError } from '../domain/basketball-data-error';
import type { LigaId, VerbandId, VereinId } from '../domain/ids';
import type { Liga } from '../domain/liga';
import { KEIN_LIGA_FILTER, naechsterStartIndex } from '../domain/liga-suche';
import type { Team } from '../domain/team';
import type { ClubIndexEntry } from './club-index';

/** What a crawl takes beside the source and the Association. */
export interface ClubCrawlOptions {
  /** Names of Clubs an earlier crawl found; these are not read again. */
  readonly knownNames: ReadonlyMap<VereinId, string>;
  /** Waits between two reads, so the source sees one request at a time, spaced. */
  readonly pause: () => Promise<void>;
}

/**
 * Every Club playing in a League of `association`, each once, by id: its
 * Leagues page by page, each League's Teams, and the name of each Club no
 * earlier crawl named (where the source knows no such Club, the name of
 * one of its Teams). A League the source does not know (any longer) is
 * skipped; any other failure rejects, so the caller keeps what it had.
 * Waits `pause` before every read but the first.
 */
export async function crawlClubs(
  data: BasketballData,
  association: VerbandId,
  options: ClubCrawlOptions
): Promise<readonly ClubIndexEntry[]> {
  const read = pacedReads(options.pause);
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
      (await clubName(data, id, read)) ??
      teamName;
    clubs.push({ id, name });
  }
  return clubs.sort((a, b) => a.id - b.id);
}

type PacedRead = <T>(read: () => Promise<T>) => Promise<T>;

function pacedReads(pause: () => Promise<void>): PacedRead {
  let first = true;
  return async (read) => {
    if (!first) {
      await pause();
    }
    first = false;
    return read();
  };
}

async function leaguesOf(
  data: BasketballData,
  association: VerbandId,
  read: PacedRead
): Promise<readonly Liga[]> {
  const filter = { ...KEIN_LIGA_FILTER, verbandIds: [association] };
  let page = (await read(() => data.ligaSuche(filter))).ersteSeite;
  const leagues = [...page.ligen];
  for (
    let start = naechsterStartIndex(page);
    start !== undefined;
    start = naechsterStartIndex(page)
  ) {
    const from = start;
    page = await read(() => data.ligaSeite(filter, from));
    leagues.push(...page.ligen);
  }
  return leagues;
}

async function teamsOf(
  data: BasketballData,
  league: LigaId,
  read: PacedRead
): Promise<readonly Team[]> {
  return orUndefinedIfNotFound(read(() => data.ligaTeams(league))).then(
    (teams) => teams ?? []
  );
}

async function clubName(
  data: BasketballData,
  club: VereinId,
  read: PacedRead
): Promise<string | undefined> {
  const teams = await orUndefinedIfNotFound(
    read(() => data.vereinsTeams(club))
  );
  return teams?.verein.name;
}

async function orUndefinedIfNotFound<T>(
  reading: Promise<T>
): Promise<T | undefined> {
  try {
    return await reading;
  } catch (error) {
    if (isBasketballDataError(error, 'not-found')) {
      return undefined;
    }
    throw error;
  }
}
