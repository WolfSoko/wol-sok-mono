import type { JsonObject } from '../lib/dbb/dbb-object';

/** The id the DBB gives a person or player it hides. */
export const HIDDEN_ID = 0;

/** The name fields of a person in a DBB response. */
export const NAME_KEYS = ['vorname', 'nachname'] as const;

const HIDDEN_NAME = /^\*+$/;

/**
 * A person in a DBB response: any object with a first or last name (a
 * player's `person`, a referee's `personData`, ...), with or without an id.
 * The anonymiser and the committed fixtures' guard both go by this.
 */
export function isPerson(object: JsonObject): boolean {
  return NAME_KEYS.some((key) => typeof object[key] === 'string');
}

/** A person the DBB hides: every name it has is stars (`***`). */
export function isHiddenPerson(object: JsonObject): boolean {
  return namesOf(object).every((name) => HIDDEN_NAME.test(name));
}

/** The first and last name a person has, those it has. */
export function namesOf(object: JsonObject): readonly string[] {
  return NAME_KEYS.flatMap((key) => {
    const name = object[key];
    return typeof name === 'string' ? [name] : [];
  });
}

/** A person's `id`; throws where it is there but no number. */
export function personIdOf(person: JsonObject): number | undefined {
  return numericId(person, 'id');
}

/** An object's season player id (`playerId`); throws where it is no number. */
export function playerIdOf(object: JsonObject): number | undefined {
  return numericId(object, 'playerId');
}

function numericId(object: JsonObject, key: string): number | undefined {
  const id = object[key];
  if (id === undefined || id === null) {
    return undefined;
  }
  if (typeof id !== 'number') {
    throw new Error(
      `${key} is no number, so it cannot be anonymised: ${JSON.stringify(id)}`
    );
  }
  return id;
}
