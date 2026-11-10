import type { BasketballData, ReadOptions } from '../basketball-data';
import { isBasketballDataError } from './basketball-data-error';
import type { PersonId, GameId, TeamId } from './ids';
import { rosterOfTeam, childrenInRoster } from './children-in-roster';
import type { Game } from './game';
import type { GameReport } from './game-report';

/** What to look for in one followed Team's Kader. */
export interface RosterSearchJob {
  readonly team: TeamId;
  /** Its last played Spiele, newest first (`lastPlayed`). */
  readonly games: readonly Game[];
  /** The marked Kinder's persons. */
  readonly children: readonly PersonId[];
}

/** The Kinder in one Kader: each person found, with their first name. */
export type ChildrenInRoster = ReadonlyMap<PersonId, string>;

/** What one Team's Spielberichte told of the marked Kinder. */
export interface RosterFinds {
  /**
   * Each Spiel read, newest first: the Kinder on the Team's own Kader, or
   * `undefined` where the Spiel has no Spielbericht yet.
   */
  readonly games: ReadonlyMap<GameId, ChildrenInRoster | undefined>;
  /**
   * Whether a read failed (offline, the DBB down) and the search stopped
   * there, so a Kind may be in a Kader not read.
   */
  readonly incomplete: boolean;
}

/** The one read the search makes. */
type GameReportReader<O extends ReadOptions> = Pick<
  BasketballData<O>,
  'gameReport'
>;

/** One Spiel's read: the Kinder its Kader named, or that it failed. */
type RosterRead =
  | { readonly wasRead: true; readonly children: ChildrenInRoster | undefined }
  | { readonly wasRead: false };

/** How many Spielberichte of one Team the search reads side by side. */
const AT_ONCE = 2;

/**
 * Looks for `job.children` in the Team's own Kader of its Spiele, never
 * anywhere else (ADR 0019). Reads the newest Spiel alone, which mostly
 * names every Kind already, then the others `AT_ONCE` at a time, newest
 * first, and stops once each Kind was found. A Spielbericht the DBB does
 * not know counts as none yet; a read that fails otherwise (offline, the
 * DBB down) leaves the search `incomplete` and ends it after its batch.
 * `options` go to every read as they are; a cancelled read ends the search.
 */
export async function searchRosters<O extends ReadOptions>(
  data: GameReportReader<O>,
  job: RosterSearchJob,
  options?: O
): Promise<RosterFinds> {
  const games = new Map<GameId, ChildrenInRoster | undefined>();
  const unfound = new Set(job.children);
  for (const batch of batchesOf(job.games)) {
    if (unfound.size === 0) {
      break;
    }
    const reads = await Promise.all(
      batch.map((game) => childrenIn(data, job, game, options))
    );
    reads.forEach((read, i) => {
      if (read.wasRead) {
        games.set(batch[i].id, read.children);
        read.children?.forEach((_firstName, person) => unfound.delete(person));
      }
    });
    if (reads.some((read) => !read.wasRead)) {
      return { games, incomplete: true };
    }
  }
  return { games, incomplete: false };
}

/** `games` as the search reads them: the newest alone, then `AT_ONCE` each. */
function batchesOf(games: readonly Game[]): readonly (readonly Game[])[] {
  const [newest, ...rest] = games;
  if (newest === undefined) {
    return [];
  }
  const batches: Game[][] = [[newest]];
  for (let i = 0; i < rest.length; i += AT_ONCE) {
    batches.push(rest.slice(i, i + AT_ONCE));
  }
  return batches;
}

/**
 * The Kinder in the Team's Kader of `game`, none where it has no
 * Spielbericht (yet, or the DBB knows none); a failed read as such, unless
 * the search was cancelled, which ends it.
 */
async function childrenIn<O extends ReadOptions>(
  data: GameReportReader<O>,
  job: RosterSearchJob,
  game: Game,
  options: O | undefined
): Promise<RosterRead> {
  let report: GameReport | undefined;
  try {
    report = await data.gameReport(game.id, options);
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }
    return isBasketballDataError(error, 'not-found')
      ? { wasRead: true, children: undefined }
      : { wasRead: false };
  }
  const roster = report && rosterOfTeam(report, game, job.team);
  return {
    wasRead: true,
    children:
      roster &&
      new Map(
        childrenInRoster(roster, job.children).map((player) => [
          player.personId,
          player.firstName,
        ])
      ),
  };
}
