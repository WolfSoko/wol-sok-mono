import { dbbStatusOf } from './envelope';

/** A result as the DBB writes one once a Spiel is played: `"78:47"`. */
const RESULT = /^\d+:\d+$/;

/**
 * Whether a DBB boxscore response (`match/id/{id}/boxscore`) is the
 * Spielbericht of a Spiel the Verband has closed: status `"0"`, a result
 * it has confirmed (`ergebnisbestaetigt`), not called off, and both Kader
 * listed. Past that the DBB rarely changes it, so the app's proxy lets the
 * CDN keep it longer. Reads only those fields, with a guard each: anything
 * else, unexpected shapes included, is not, and keeps the short cache.
 */
export function dbbBoxscoreFinished(response: unknown): boolean {
  if (dbbStatusOf(response) !== 'ok') {
    return false;
  }
  const data = field(response, 'data');
  const boxscore = field(data, 'matchBoxscore');
  return (
    field(data, 'ergebnisbestaetigt') === true &&
    field(data, 'abgesagt') !== true &&
    isResult(field(data, 'result')) &&
    isNonEmptyList(field(boxscore, 'homePlayerStats')) &&
    isNonEmptyList(field(boxscore, 'guestPlayerStats'))
  );
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

function isNonEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}
