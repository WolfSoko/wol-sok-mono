/**
 * Turns the raw DBB responses `record-fixtures.ts` recorded into the basketball
 * data lib's fixtures: cut down where `FIXTURE_REQUESTS` says, every person
 * replaced by an invented one (`anonymiseFixtures`), and written only if no
 * original name or person id survives.
 *
 *   npx tsx tools/korbjaeger/anonymise-fixtures.ts <raw-dir>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  anonymiseFixtures,
  survivingPersonData,
} from '../../libs/features/basketball-data/src/testing/anonymise-fixtures';
import {
  FIXTURE_REQUESTS,
  FIXTURES_DIR,
  type FixtureTrim,
} from './fixture-requests';
import { rawDirOutsideWorkspace } from './raw-dir';

/** Change it only to get other invented names, e.g. after a clash. */
const SEED = 'korbjaeger-fixtures';

function main(): void {
  const rawDir = rawDirOutsideWorkspace(process.argv[2]);
  const original = Object.fromEntries(
    FIXTURE_REQUESTS.map((fixture) => [
      fixture.name,
      trimmed(
        readJson(join(rawDir, `${fixture.name}.json`)),
        fixture.trims ?? []
      ),
    ])
  );
  const anonymised = anonymiseFixtures(original, SEED);
  const surviving = survivingPersonData(original, anonymised);
  if (surviving.length > 0) {
    throw new Error(
      `person data survived, nothing written: ${surviving.join(', ')}`
    );
  }
  const fixturesDir = resolve(__dirname, '../..', FIXTURES_DIR);
  for (const [name, content] of Object.entries(anonymised)) {
    writeFileSync(
      join(fixturesDir, `${name}.json`),
      `${JSON.stringify(content, null, 2)}\n`
    );
    console.log(`wrote ${name}`);
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function trimmed(response: unknown, trims: readonly FixtureTrim[]): unknown {
  const copy: unknown = structuredClone(response);
  for (const trim of trims) {
    const list = at(copy, trim.path);
    if (!Array.isArray(list)) {
      throw new Error(`no list at ${trim.path.join('.')}`);
    }
    list.splice(trim.keep);
  }
  return copy;
}

function at(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (current, key) =>
      typeof current === 'object' && current !== null
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value
  );
}

main();
