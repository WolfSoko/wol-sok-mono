/**
 * Records the DBB responses of `FIXTURE_REQUESTS` into a folder outside the
 * workspace, raw: they hold real children's names, so they never enter the
 * repo. `anonymise-fixtures.ts` turns them into the lib's fixtures.
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx tools/korbjaeger/record-fixtures.ts <raw-dir> [name...]
 *
 * With names, it records only those fixtures, so adding one leaves the
 * others' recordings as they were.
 *
 * Polite on purpose: one request at a time, a pause between them, and a
 * User-Agent that names the app.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import {
  DBB_BASE_URL,
  dbbFetchInput,
  dbbHttpRequest,
  type DbbRequest,
} from '../../libs/features/basketball-data/src/lib/dbb/dbb-request';
import { FIXTURE_REQUESTS, type FixtureRequest } from './fixture-requests';
import { rawDirOutsideWorkspace } from './raw-dir';

const USER_AGENT = 'Korbjaeger-dev (+https://korb.wolsok.de)';
const PAUSE_MS = 1000;

async function main(): Promise<void> {
  const rawDir = rawDirOutsideWorkspace(process.argv[2]);
  mkdirSync(rawDir, { recursive: true });
  for (const fixture of selected(process.argv.slice(3))) {
    const response = await fetchDbb(fixture.request);
    writeFileSync(
      join(rawDir, `${fixture.name}.json`),
      JSON.stringify(response, null, 2)
    );
    console.log(`recorded ${fixture.name}`);
    await pause(PAUSE_MS);
  }
}

/** The fixtures `names` name, all of them without names. */
function selected(names: readonly string[]): readonly FixtureRequest[] {
  if (names.length === 0) {
    return FIXTURE_REQUESTS;
  }
  return names.map((name) => {
    const fixture = FIXTURE_REQUESTS.find((request) => request.name === name);
    if (fixture === undefined) {
      throw new Error(`no such fixture: ${name}`);
    }
    return fixture;
  });
}

async function fetchDbb(request: DbbRequest): Promise<unknown> {
  const http = dbbHttpRequest(request);
  const { url, ...init } = dbbFetchInput(DBB_BASE_URL, http, {
    'user-agent': USER_AGENT,
  });
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${http.method} ${http.path}: HTTP ${response.status}`);
  }
  return response.json();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
