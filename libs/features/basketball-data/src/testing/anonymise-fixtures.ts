import {
  INVENTED_ID_BASE,
  INVENTED_ID_RANGE,
  INVENTED_NACHNAMEN,
  INVENTED_VORNAMEN,
} from './invented-names';

/** Fixture files by name, as parsed JSON. */
export type FixtureFiles = Readonly<Record<string, unknown>>;

type JsonObject = Readonly<Record<string, unknown>>;

/** Where the DBB hides a person: id 0 and stars for the name. */
const HIDDEN_PERSON_ID = 0;

/** Fields that hold contact details of a Verein's officials. */
const CONTACT_FIELDS: ReadonlySet<string> = new Set(['kontaktData']);

/**
 * The DBB responses in `files` with every person made up: each person's
 * first and last name and id (`person.id`, `personData.id`) and each
 * season player id (`playerId`) are replaced by invented ones, and contact
 * details are dropped. The mapping is seeded and keyed by the original id,
 * so one person keeps one invented id and name across all files of a run.
 * Persons the DBB already hides stay as they are; ids of Teams, Vereine,
 * Ligen, Spiele and Hallen stay too.
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
 * What of the persons in `original` still shows in `anonymised`: their
 * names in any person, the full name anywhere, their ids in any person or
 * player id. Empty when the anonymisation held.
 */
export function survivingPersonData(
  original: FixtureFiles,
  anonymised: FixtureFiles
): readonly string[] {
  const before = collectPersonData(Object.values(original));
  const after = collectPersonData(Object.values(anonymised));
  const texts = collectStrings(Object.values(anonymised));
  return [
    ...[...after.names]
      .filter((name) => before.names.has(name))
      .map((name) => `name ${name}`),
    ...[...before.fullNames]
      .filter((fullName) => texts.some((text) => text.includes(fullName)))
      .map((fullName) => `full name ${fullName}`),
    ...[...after.ids]
      .filter((id) => before.ids.has(id))
      .map((id) => `id ${id}`),
  ];
}

interface InventedName {
  readonly vorname: string;
  readonly nachname: string;
}

const NAME_COMBINATIONS = INVENTED_VORNAMEN.length * INVENTED_NACHNAMEN.length;

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
    if (isPlayer(object)) {
      copy['playerId'] = this.inventedId('player', object.playerId);
    }
    if (isNamedPerson(object)) {
      Object.assign(copy, this.inventedPerson(object));
    }
    return copy;
  }

  /** The invented id (where the person has one) and names of `person`. */
  private inventedPerson(person: NamedPerson): JsonObject {
    const personId =
      typeof person.id === 'number'
        ? this.inventedId('person', person.id)
        : undefined;
    const nameKey =
      personId === undefined
        ? `name:${person.vorname} ${person.nachname}`
        : `person:${personId}`;
    return {
      ...(personId === undefined ? {} : { id: personId }),
      ...this.inventedName(nameKey),
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
      vorname: INVENTED_VORNAMEN[combination % INVENTED_VORNAMEN.length],
      nachname:
        INVENTED_NACHNAMEN[Math.floor(combination / INVENTED_VORNAMEN.length)],
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
  readonly names: Set<string>;
  readonly fullNames: Set<string>;
  readonly ids: Set<number>;
}

function collectPersonData(values: readonly unknown[]): PersonData {
  const data: PersonData = {
    names: new Set(),
    fullNames: new Set(),
    ids: new Set(),
  };
  walk(values, (object) => {
    if (isPlayer(object)) {
      data.ids.add(object['playerId']);
    }
    if (isNamedPerson(object)) {
      if (typeof object.id === 'number') {
        data.ids.add(object.id);
      }
      data.names.add(object.vorname);
      data.names.add(object.nachname);
      data.fullNames.add(`${object.vorname} ${object.nachname}`);
    }
  });
  return data;
}

function collectStrings(values: readonly unknown[]): readonly string[] {
  const strings: string[] = [];
  walk(values, (object) => {
    for (const field of Object.values(object)) {
      if (typeof field === 'string') {
        strings.push(field);
      }
    }
  });
  return strings;
}

function walk(value: unknown, visit: (object: JsonObject) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item: unknown) => walk(item, visit));
  } else if (isJsonObject(value)) {
    visit(value);
    Object.values(value).forEach((field) => walk(field, visit));
  }
}

interface NamedPerson extends JsonObject {
  readonly id?: unknown;
  readonly vorname: string;
  readonly nachname: string;
}

/** A person the DBB names, so not one it hides (`anonym`, id 0). */
function isNamedPerson(object: JsonObject): object is NamedPerson {
  return (
    typeof object['vorname'] === 'string' &&
    typeof object['nachname'] === 'string' &&
    object['anonym'] !== true &&
    object['id'] !== HIDDEN_PERSON_ID
  );
}

type Player = JsonObject & { readonly playerId: number };

/** A player entry with a season player id that is not hidden. */
function isPlayer(object: JsonObject): object is Player {
  return (
    typeof object['playerId'] === 'number' &&
    object['playerId'] !== HIDDEN_PERSON_ID
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
