import type {
  Roster,
  RosterEntry,
  GameReport,
  PlayerStats,
} from '../domain/game-report';
import { DbbObject } from './dbb-object';
import { optionalField } from './optional-field';

/** A side the boxscore lists no players for. */
const NO_ROSTER: Roster = { playerStatsRecorded: false, entries: [] };

/** The shirt number the DBB lists for every player where it has none. */
const NO_SHIRT_NUMBER = '0';

/**
 * A Spiel's Spielbericht (`match/id/{id}/boxscore`), or `undefined` while
 * the DBB has none (no Kader listed). A Kader whose numbers are all 0 was
 * not recorded: it says so and its entries carry no Spielerwerte, rather
 * than zeros.
 */
export function mapGameReport(data: unknown): GameReport | undefined {
  const match = DbbObject.of(data, 'boxscore');
  const gameId = match.number('matchId');
  const boxscore = match.optionalObject('matchBoxscore');
  const home = boxscore ? mapRosterOf(boxscore, 'homePlayerStats') : NO_ROSTER;
  const away = boxscore ? mapRosterOf(boxscore, 'guestPlayerStats') : NO_ROSTER;
  if (home.entries.length === 0 && away.entries.length === 0) {
    return undefined;
  }
  return { gameId, home, away };
}

/** The player lists of a boxscore (`matchBoxscore`), one per side. */
export type PlayerStatsKey = 'homePlayerStats' | 'guestPlayerStats';

/**
 * One side's Kader of a boxscore (`matchBoxscore`), every entry checked as
 * `mapGameReport` reads it: throws where one cannot be read.
 */
export function mapRosterOf(boxscore: DbbObject, key: PlayerStatsKey): Roster {
  return mapRoster(boxscore.optionalObjects(key));
}

/** Each row mapped once; the numbers kept only where any is not 0. */
function mapRoster(playerStats: readonly DbbObject[]): Roster {
  const numbers = numbersRecorded(playerStats);
  const entries = playerStats.map((stats) => mapEntry(stats, numbers));
  const playerStatsRecorded = entries.some(
    (entry) => entry.playerStats !== undefined && hasStats(entry.playerStats)
  );
  return {
    playerStatsRecorded,
    entries: playerStatsRecorded ? entries : entries.map(withoutPlayerStats),
  };
}

function withoutPlayerStats({
  playerStats: _none,
  ...entry
}: RosterEntry): RosterEntry {
  return entry;
}

/** Whether the Kader lists shirt numbers: not where every named player has 0. */
function numbersRecorded(playerStats: readonly DbbObject[]): boolean {
  return playerStats
    .map((stats) => stats.object('player'))
    .filter((player) => !isAnonymous(player, player.object('person')))
    .some(
      (player) =>
        (player.optionalString('no') ?? NO_SHIRT_NUMBER) !== NO_SHIRT_NUMBER
    );
}

function mapEntry(
  stats: DbbObject,
  shirtNumbersRecorded: boolean
): RosterEntry {
  const player = stats.object('player');
  const person = player.object('person');
  const playerStats = mapPlayerStats(stats);
  if (isAnonymous(player, person)) {
    return { kind: 'anonymous', playerStats };
  }
  const shirtNumber = player.optionalString('no')?.trim();
  return {
    kind: 'named',
    personId: person.number('id'),
    firstName: person.string('vorname').trim(),
    lastName: person.string('nachname').trim(),
    ...optionalField(
      'shirtNumber',
      shirtNumbersRecorded && shirtNumber ? shirtNumber : undefined
    ),
    playerStats,
  };
}

/** The DBB hides a player with `anonym` and person id 0. */
function isAnonymous(player: DbbObject, person: DbbObject): boolean {
  return (
    player.optionalBoolean('anonym') ||
    person.optionalBoolean('anonym') ||
    person.optionalNumber('id') === 0
  );
}

function mapPlayerStats(stats: DbbObject): PlayerStats {
  const freeThrows = stats.optionalObject('onePoints');
  return {
    points: count(stats, 'pts'),
    twoPointers: madeOf(stats.optionalObject('twoPoints')),
    threePointers: madeOf(stats.optionalObject('threePoints')),
    freeThrows: {
      made: madeOf(freeThrows),
      attempted: freeThrows === undefined ? 0 : count(freeThrows, 'attempted'),
    },
    fouls: count(stats, 'fouls'),
  };
}

function hasStats(stats: PlayerStats): boolean {
  return [
    stats.points,
    stats.twoPointers,
    stats.threePointers,
    stats.freeThrows.made,
    stats.freeThrows.attempted,
    stats.fouls,
  ].some((value) => value !== 0);
}

function madeOf(shot: DbbObject | undefined): number {
  return shot === undefined ? 0 : count(shot, 'made');
}

function count(object: DbbObject, key: string): number {
  return object.optionalNumber(key) ?? 0;
}
