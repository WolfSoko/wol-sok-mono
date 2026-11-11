/**
 * The DBB's keys that say something of a person, dropped with all below
 * them: a player's or a referee's data, a name wherever it sits, a player
 * id, and a match's top performances (each player's values, by id).
 */
const PERSON_KEYS = new Set([
  'person',
  'personData',
  'vorname',
  'nachname',
  'playerId',
  'topPerformances',
]);

/**
 * A DBB answer without the persons in it (ADR 0019), for an app to keep on
 * the device: everything `PERSON_KEYS` names dropped, at any depth; all
 * else as it was, so it maps as the whole answer does, except
 * for a Spielbericht, which is all persons and is never kept. A copy;
 * `body` stays as it is.
 */
export function dbbWithoutPersons(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map(dbbWithoutPersons);
  }
  if (typeof body !== 'object' || body === null) {
    return body;
  }
  return Object.fromEntries(
    Object.entries(body)
      .filter(([key]) => !PERSON_KEYS.has(key))
      .map(([key, value]) => [key, dbbWithoutPersons(value)])
  );
}
