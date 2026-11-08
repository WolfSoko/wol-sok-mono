import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  INVENTED_ID_BASE,
  INVENTED_NACHNAMEN,
  INVENTED_VORNAMEN,
} from './invented-names';

const FIXTURES_DIR = join(__dirname, '../lib/dbb/fixtures');
const HIDDEN_NAMES: ReadonlySet<string> = new Set(['***', '****']);
const VORNAMEN: ReadonlySet<string> = new Set(INVENTED_VORNAMEN);
const NACHNAMEN: ReadonlySet<string> = new Set(INVENTED_NACHNAMEN);

interface Person {
  readonly file: string;
  readonly id?: unknown;
  readonly vorname: string;
  readonly nachname: string;
}

/**
 * The guard against committing a raw DBB response: every person in the
 * committed fixtures must be one `anonymiseFixtures` invented, or one the
 * DBB itself hides.
 */
describe('committed DBB fixtures', () => {
  const files = readdirSync(FIXTURES_DIR).filter((name) =>
    name.endsWith('.json')
  );
  const fixtures = files.map((file) => ({
    file,
    content: JSON.parse(
      readFileSync(join(FIXTURES_DIR, file), 'utf8')
    ) as unknown,
  }));
  const persons = fixtures.flatMap(({ file, content }) =>
    personsIn(file, content)
  );
  const playerIds = fixtures.flatMap(({ content }) => playerIdsIn(content));

  it('hold persons, so the check below checks something', () => {
    expect(persons.length).toBeGreaterThan(20);
    expect(playerIds.length).toBeGreaterThan(20);
  });

  it('name only invented or hidden persons', () => {
    const real = persons.filter(
      (person) =>
        !isHidden(person) &&
        !(VORNAMEN.has(person.vorname) && NACHNAMEN.has(person.nachname))
    );

    expect(
      real.map(
        (person) => `${person.file}: ${person.vorname} ${person.nachname}`
      )
    ).toEqual([]);
  });

  it('give persons and players only invented or hidden ids', () => {
    const ids = [...persons.map((person) => person.id), ...playerIds];

    expect(
      ids.filter(
        (id) => id !== 0 && !(typeof id === 'number' && id >= INVENTED_ID_BASE)
      )
    ).toEqual([]);
  });
});

function isHidden(person: Person): boolean {
  return HIDDEN_NAMES.has(person.vorname) && HIDDEN_NAMES.has(person.nachname);
}

function personsIn(file: string, value: unknown): readonly Person[] {
  return objectsIn(value)
    .filter(
      (object) =>
        typeof object['vorname'] === 'string' ||
        typeof object['nachname'] === 'string'
    )
    .map((object) => ({
      file,
      id: object['id'],
      vorname: String(object['vorname']),
      nachname: String(object['nachname']),
    }));
}

function playerIdsIn(value: unknown): readonly unknown[] {
  return objectsIn(value)
    .filter((object) => 'playerId' in object)
    .map((object) => object['playerId']);
}

function objectsIn(
  value: unknown
): readonly Readonly<Record<string, unknown>>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => objectsIn(item));
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const object = value as Readonly<Record<string, unknown>>;
  return [
    object,
    ...Object.values(object).flatMap((field) => objectsIn(field)),
  ];
}
