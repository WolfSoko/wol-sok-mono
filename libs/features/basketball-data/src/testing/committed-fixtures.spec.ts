import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JsonObject } from '../lib/dbb/dbb-object';
import { KNOWN_STRING_KEYS } from './fixture-fields';
import {
  HIDDEN_ID,
  isHiddenPerson,
  isPerson,
  NAME_KEYS,
  personIdOf,
  playerIdOf,
} from './fixture-persons';
import {
  INVENTED_ID_BASE,
  INVENTED_NACHNAMEN,
  INVENTED_VORNAMEN,
} from './invented-names';
import { objectsIn, stringFieldsIn } from './json-walk';

const FIXTURES_DIR = join(__dirname, '../lib/dbb/fixtures');
const INVENTED: Readonly<
  Record<(typeof NAME_KEYS)[number], ReadonlySet<string>>
> = {
  vorname: new Set(INVENTED_VORNAMEN),
  nachname: new Set(INVENTED_NACHNAMEN),
};

interface Fixture {
  readonly file: string;
  readonly content: unknown;
}

/**
 * The guard against committing a raw DBB response: every person in the
 * committed fixtures (any object with a name, as the anonymiser sees it)
 * must be one `anonymiseFixtures` invented, or one the DBB itself hides,
 * and every string field must be one whose content is known.
 */
describe('committed DBB fixtures', () => {
  const fixtures: readonly Fixture[] = readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((file) => ({
      file,
      content: JSON.parse(
        readFileSync(join(FIXTURES_DIR, file), 'utf8')
      ) as unknown,
    }));
  const objects = fixtures.flatMap(({ file, content }) =>
    objectsIn(content).map((object) => ({ file, object }))
  );
  const persons = objects.filter(({ object }) => isPerson(object));

  it('hold persons and players, so the checks below check something', () => {
    expect(persons.length).toBeGreaterThan(20);
    expect(
      objects.filter(({ object }) => playerIdOf(object) !== undefined).length
    ).toBeGreaterThan(20);
  });

  it('name only invented or hidden persons', () => {
    const real = persons.filter(
      ({ object }) => !isHiddenPerson(object) && !hasInventedNames(object)
    );

    expect(
      real.map(({ file, object }) => `${file}: ${JSON.stringify(object)}`)
    ).toEqual([]);
  });

  it('give persons and players only invented or hidden ids', () => {
    const ids = [
      ...persons.map(({ object }) => personIdOf(object)),
      ...objects.map(({ object }) => playerIdOf(object)),
    ];

    expect(
      ids.filter(
        (id) => id !== undefined && id !== HIDDEN_ID && id < INVENTED_ID_BASE
      )
    ).toEqual([]);
  });

  it('hold no string field of unknown content', () => {
    const unknown = fixtures.flatMap(({ file, content }) =>
      stringFieldsIn(content)
        .filter(({ key }) => !KNOWN_STRING_KEYS.has(key))
        .map(({ key }) => `${file}: ${key}`)
    );

    expect([...new Set(unknown)]).toEqual([]);
  });
});

function hasInventedNames(person: JsonObject): boolean {
  return NAME_KEYS.every((key) => {
    const name = person[key];
    return (
      name === undefined ||
      name === null ||
      (typeof name === 'string' && INVENTED[key].has(name))
    );
  });
}
