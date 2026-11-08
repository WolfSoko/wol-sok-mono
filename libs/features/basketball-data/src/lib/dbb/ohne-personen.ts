/** The DBB's keys that hold a person: a player's or a referee's data. */
const PERSON_SCHLUESSEL = new Set(['person', 'personData']);

/** The DBB's keys of a name, wherever one sits outside a person object. */
const NAMEN_SCHLUESSEL = new Set(['vorname', 'nachname']);

/**
 * A DBB answer without the persons in it (ADR 0019), for an app to keep on
 * the device: every `person`/`personData` object and name dropped, at any
 * depth; all else as it was, so it maps as the whole answer does, except
 * for a Spielbericht, which is all persons and is never kept. A copy;
 * `body` stays as it is.
 */
export function dbbOhnePersonen(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map(dbbOhnePersonen);
  }
  if (typeof body !== 'object' || body === null) {
    return body;
  }
  return Object.fromEntries(
    Object.entries(body)
      .filter(
        ([schluessel]) =>
          !PERSON_SCHLUESSEL.has(schluessel) &&
          !NAMEN_SCHLUESSEL.has(schluessel)
      )
      .map(([schluessel, wert]) => [schluessel, dbbOhnePersonen(wert)])
  );
}
