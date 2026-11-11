import {
  INVENTED_ID_BASE,
  INVENTED_ID_RANGE,
  INVENTED_LAST_NAMES,
  INVENTED_FIRST_NAMES,
} from './invented-names';
import {
  HIDDEN_ID,
  isHiddenPerson,
  isPerson,
  NAME_KEYS,
  namesOf,
  personIdOf,
  playerIdOf,
} from './fixture-persons';
import { isJsonObject, type JsonObject } from '../lib/dbb/dbb-object';
import { PUBLIC_TEXT_KEYS } from './fixture-fields';
import { objectsIn, stringFieldsIn } from './json-walk';

/** Fixture files by name, as parsed JSON. */
export type FixtureFiles = Readonly<Record<string, unknown>>;

/** Fields that hold contact details of a Verein's officials. */
const CONTACT_FIELDS: ReadonlySet<string> = new Set(['kontaktData']);

/**
 * The DBB responses in `files` with every person made up: each person's
 * first and last name and id (`person.id`, `personData.id`) and each
 * season player id (`playerId`) are replaced by invented ones, and contact
 * details are dropped. The mapping is seeded and keyed by the original id,
 * so one person keeps one invented id and name across all files of a run.
 * A person is any object with a first or last name (`isPerson`), with or
 * without an id; persons the DBB already hides (names of stars) stay as
 * they are, and so do the ids of Teams, Vereine, Ligen, Spiele and Hallen.
 * Throws on a person or player id that is no number, which it could not
 * replace reliably.
 */
export function anonymiseFixtures(
  files: FixtureFiles,
  seed: string
): FixtureFiles {
  const anonymiser = new Anonymiser(seed);
  return Object.fromEntries(
    Object.keys(files)
      .sort()
      .map((name) => [name, anonymiser.anonymise(files[name])])
  );
}

/**
 * What of the persons in `original` still shows in `anonymised`: any of
 * their first or last names as a word in any string of any file (so in
 * "Vorname Nachname" and "Nachname, Vorname" alike, and in fields the
 * anonymiser does not know) but the public names of organisations and
 * places (`PUBLIC_TEXT_KEYS`), and any of their ids as a person or player
 * id. Empty when the anonymisation held.
 */
export function survivingPersonData(
  original: FixtureFiles,
  anonymised: FixtureFiles
): readonly string[] {
  const before = personDataIn(Object.values(original));
  const names = [...before.names].map((name) => ({
    name,
    word: wordPattern(name),
  }));
  return Object.entries(anonymised).flatMap(([file, content]) => [
    ...stringFieldsIn(content)
      .filter(({ key }) => !PUBLIC_TEXT_KEYS.has(key))
      .flatMap(({ key, text }) =>
        names
          .filter(({ word }) => word.test(text))
          .map(({ name }) => `name ${name} in ${file} (${key})`)
      ),
    ...[...personDataIn([content]).ids]
      .filter((id) => before.ids.has(id))
      .map((id) => `id ${id} in ${file}`),
  ]);
}

interface InventedName {
  readonly vorname: string;
  readonly nachname: string;
}

const NAME_COMBINATIONS =
  INVENTED_FIRST_NAMES.length * INVENTED_LAST_NAMES.length;

class Anonymiser {
  private readonly invented = new Map<string, number>();
  private readonly taken = new Set<number>();
  private readonly names = new Map<string, InventedName>();
  private readonly namesTaken = new Set<number>();

  public constructor(private readonly seed: string) {}

  public anonymise(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => this.anonymise(item));
    }
    if (!isJsonObject(value)) {
      return value;
    }
    return this.anonymiseObject(value);
  }

  private anonymiseObject(object: JsonObject): JsonObject {
    const copy: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(object)) {
      copy[key] = CONTACT_FIELDS.has(key) ? null : this.anonymise(field);
    }
    const playerId = playerIdOf(object);
    if (playerId !== undefined && playerId !== HIDDEN_ID) {
      copy['playerId'] = this.inventedId('player', playerId);
    }
    if (isPerson(object)) {
      Object.assign(copy, this.inventedPerson(object));
    }
    return copy;
  }

  /** The invented id (where it has one) and names of a person the DBB names. */
  private inventedPerson(person: JsonObject): JsonObject {
    const originalId = personIdOf(person);
    if (isHiddenPerson(person)) {
      return {};
    }
    const personId =
      originalId === undefined || originalId === HIDDEN_ID
        ? undefined
        : this.inventedId('person', originalId);
    const name = this.inventedName(
      personId === undefined
        ? `name:${namesOf(person).join(' ')}`
        : `person:${personId}`
    );
    return {
      ...(personId === undefined ? {} : { id: personId }),
      ...Object.fromEntries(
        NAME_KEYS.filter((key) => typeof person[key] === 'string').map(
          (key) => [key, name[key]]
        )
      ),
    };
  }

  /**
   * A first and last name for `nameKey`, the same each time it is asked
   * for and, while combinations last, one no other person of the run has.
   */
  private inventedName(nameKey: string): InventedName {
    const known = this.names.get(nameKey);
    if (known !== undefined) {
      return known;
    }
    const start = hash(`${this.seed}:name:${nameKey}`) % NAME_COMBINATIONS;
    let combination = start;
    while (
      this.namesTaken.has(combination) &&
      (combination + 1) % NAME_COMBINATIONS !== start
    ) {
      combination = (combination + 1) % NAME_COMBINATIONS;
    }
    this.namesTaken.add(combination);
    const name = {
      vorname: INVENTED_FIRST_NAMES[combination % INVENTED_FIRST_NAMES.length],
      nachname:
        INVENTED_LAST_NAMES[
          Math.floor(combination / INVENTED_FIRST_NAMES.length)
        ],
    };
    this.names.set(nameKey, name);
    return name;
  }

  private inventedId(kind: string, original: number): number {
    const key = `${kind}:${original}`;
    const known = this.invented.get(key);
    if (known !== undefined) {
      return known;
    }
    let id =
      INVENTED_ID_BASE + (hash(`${this.seed}:${key}`) % INVENTED_ID_RANGE);
    while (this.taken.has(id)) {
      id += 1;
    }
    this.invented.set(key, id);
    this.taken.add(id);
    return id;
  }
}

interface PersonData {
  readonly names: ReadonlySet<string>;
  readonly ids: ReadonlySet<number>;
}

/** The names and ids of the persons and players the DBB names in `values`. */
function personDataIn(values: readonly unknown[]): PersonData {
  const names = new Set<string>();
  const ids = new Set<number>();
  for (const object of objectsIn(values)) {
    const playerId = playerIdOf(object);
    if (playerId !== undefined && playerId !== HIDDEN_ID) {
      ids.add(playerId);
    }
    if (isPerson(object) && !isHiddenPerson(object)) {
      const personId = personIdOf(object);
      if (personId !== undefined && personId !== HIDDEN_ID) {
        ids.add(personId);
      }
      namesOf(object)
        .map((name) => name.trim())
        .filter((name) => name !== '')
        .forEach((name) => names.add(name));
    }
  }
  return { names, ids };
}

/** `name` as a whole word: not inside a longer name or number. */
function wordPattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u');
}

/** FNV-1a, 32 bits: a small, stable hash for the seeded mapping. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}
