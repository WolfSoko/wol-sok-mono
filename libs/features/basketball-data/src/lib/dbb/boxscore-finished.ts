import { DbbObject } from './dbb-object';
import { dbbStatusOf } from './envelope';
import { mapRosterOf, type PlayerStatsKey } from './map-game-report';

/** A result as the DBB writes one once a Spiel is played: `"78:47"`. */
const RESULT = /^\d+:\d+$/;

/**
 * Whether a DBB boxscore response (`match/id/{id}/boxscore`) is the
 * Spielbericht of a Spiel the Verband has closed: status `"0"`, a result
 * it has confirmed (`ergebnisbestaetigt`), not called off, and both Kader
 * listed, each entry one the adapter can read (`mapRosterOf`). Past that
 * the DBB rarely changes it, so the app's proxy lets the CDN keep it
 * longer. Reads only those fields: anything else, unexpected shapes
 * included, is not, and keeps the short cache.
 */
export function dbbBoxscoreFinished(response: unknown): boolean {
  if (dbbStatusOf(response) !== 'ok') {
    return false;
  }
  const data = field(response, 'data');
  return (
    field(data, 'ergebnisbestaetigt') === true &&
    field(data, 'abgesagt') !== true &&
    isResult(field(data, 'result')) &&
    bothRostersReadable(field(data, 'matchBoxscore'))
  );
}

const ROSTER: readonly PlayerStatsKey[] = [
  'homePlayerStats',
  'guestPlayerStats',
];

/** Whether both Kader list players, every one as the adapter reads it. */
function bothRostersReadable(matchBoxscore: unknown): boolean {
  try {
    const boxscore = DbbObject.of(matchBoxscore, 'boxscore.matchBoxscore');
    return ROSTER.every((key) => mapRosterOf(boxscore, key).entries.length > 0);
  } catch {
    // an entry the adapter refuses: its read answers unexpected-shape
    return false;
  }
}

/** `object[key]`, or `undefined` where `object` is no object. */
function field(object: unknown, key: string): unknown {
  return typeof object === 'object' && object !== null
    ? (object as Readonly<Record<string, unknown>>)[key]
    : undefined;
}

function isResult(value: unknown): boolean {
  return typeof value === 'string' && RESULT.test(value);
}
