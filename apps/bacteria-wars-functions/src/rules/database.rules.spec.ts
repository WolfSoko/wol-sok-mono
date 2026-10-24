import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, remove, set } from 'firebase/database';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The game's Realtime Database rules
 * (`apps/bacteria-game-remote/database.rules.json`): the opt-in `status`,
 * the counted `connections` nobody reads, and bans (ADR 0012). Run by
 * `nx run bacteria-wars-functions:test-rules`.
 */

const RULES = join(
  __dirname,
  '../../../bacteria-game-remote/database.rules.json'
);

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bacteria-wars',
    database: { rules: readFileSync(RULES, 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
});

const db = (uid: string) => env.authenticatedContext(uid).database();
const online = () => ({ state: 'online', at: Date.now() });

async function ban(uid: string, until: number): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), `bans/${uid}`), until);
  });
}

describe.each(['status', 'connections'])('%s', (path) => {
  it('takes the player own state and nothing else', async () => {
    await assertSucceeds(set(ref(db('ana'), `${path}/ana`), online()));
    await assertFails(set(ref(db('ana'), `${path}/bob`), online()));
    await assertFails(
      set(ref(db('ana'), `${path}/ana`), { ...online(), extra: 1 })
    );
    await assertFails(
      set(ref(db('ana'), `${path}/ana`), { state: 'away', at: 1 })
    );
  });

  it('refuses a banned player going online, but lets them go offline', async () => {
    await assertSucceeds(set(ref(db('ana'), `${path}/ana`), online()));
    await ban('ana', 0);
    await assertFails(set(ref(db('ana'), `${path}/ana`), online()));
    await assertSucceeds(remove(ref(db('ana'), `${path}/ana`)));
  });

  it('lets a ban end by itself', async () => {
    await ban('ana', Date.now() - 1000);
    await assertSucceeds(set(ref(db('ana'), `${path}/ana`), online()));
    await ban('ana', Date.now() + 60_000);
    await assertFails(set(ref(db('ana'), `${path}/ana`), online()));
  });
});

describe('reading', () => {
  it('shows status to anyone signed in, connections to nobody', async () => {
    await assertSucceeds(get(ref(db('bob'), 'status/ana')));
    await assertFails(get(ref(db('ana'), 'connections/ana')));
    await assertFails(get(ref(db('ana'), 'connections')));
  });

  it('shows a ban to its player only, and lets nobody write one', async () => {
    await ban('ana', 0);
    await assertSucceeds(get(ref(db('ana'), 'bans/ana')));
    await assertFails(get(ref(db('bob'), 'bans/ana')));
    await assertFails(set(ref(db('ana'), 'bans/ana'), null));
    await assertFails(set(ref(db('bob'), 'bans/bob'), 1));
  });
});
