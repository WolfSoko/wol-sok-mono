import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Bytes,
  collection,
  deleteDoc,
  doc,
  Firestore,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Engine, loadEngine } from '../engine';
import { MAX_SUBMISSION_BYTES } from '../replays/derive';

/**
 * The game's Firestore rules (`apps/bacteria-game-remote/firestore.rules`)
 * against the emulator: the paths of ADR 0011 and ADR 0012, the writer
 * pinning of command documents and `notBanned()` on client writes. Run by
 * `nx run bacteria-wars-functions:test-rules`.
 */

const RULES = join(__dirname, '../../../bacteria-game-remote/firestore.rules');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bacteria-wars',
    firestore: { rules: readFileSync(RULES, 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

/** A player's Firestore: a guest unless claims say otherwise. */
function as(uid: string, claims: Record<string, unknown> = {}): Firestore {
  // The context's compat Firestore is what the modular calls take.
  return env
    .authenticatedContext(uid, claims)
    .firestore() as unknown as Firestore;
}

/** The owner: the claim, a verified email, Google, signed in just now. */
function asAdmin(uid = 'owner', signedInSecAgo = 0): Firestore {
  const now = Math.floor(Date.now() / 1000) - signedInSecAgo;
  return as(uid, {
    admin: true,
    email_verified: true,
    iat: now,
    auth_time: now,
    firebase: { sign_in_provider: 'google.com', identities: {} },
  });
}

/** Writes documents past the rules. */
async function seed(write: (db: Firestore) => Promise<unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (context: RulesTestContext) => {
    await write(context.firestore() as unknown as Firestore);
  });
}

function later(ms: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + ms);
}

/** Today's UTC day, as the rules see it. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function ban(uid: string, until: Timestamp | null): Promise<void> {
  await seed((db) =>
    setDoc(doc(db, 'bans', uid), {
      since: Timestamp.now(),
      until,
      reason: 'spam',
    })
  );
}

const storedValue = () => ({ json: '{}', updatedAt: serverTimestamp() });
const profile = (extra: Record<string, unknown> = {}) => ({
  name: 'Ana',
  motto: '',
  avatar: { kind: 'preset', id: 3 },
  shareStatus: true,
  updatedAt: serverTimestamp(),
  ...extra,
});

describe('bans', () => {
  it('lets a banned player write nothing, but delete their data', async () => {
    await seed((db) =>
      setDoc(doc(db, 'players/ana/storage/bacteria-game.progress'), {
        json: '{}',
      })
    );
    await ban('ana', null);
    const db = as('ana');
    await assertFails(
      setDoc(
        doc(db, 'players/ana/storage/bacteria-game.settings'),
        storedValue()
      )
    );
    await assertFails(setDoc(doc(db, 'profiles/ana'), profile()));
    await assertFails(
      setDoc(doc(db, 'queue/ana'), {
        since: serverTimestamp(),
        seen: serverTimestamp(),
        expireAt: later(HOUR / 2),
        level: null,
        claim: null,
      })
    );
    await assertFails(
      setDoc(doc(db, 'invites/abcdefghjkmnpqrstuvw'), {
        from: 'ana',
        at: serverTimestamp(),
        expireAt: later(DAY),
      })
    );
    await assertSucceeds(
      deleteDoc(doc(db, 'players/ana/storage/bacteria-game.progress'))
    );
  });

  it('lets a ban end by itself at until', async () => {
    await ban('ana', Timestamp.fromMillis(Date.now() - 1000));
    await assertSucceeds(
      setDoc(
        doc(as('ana'), 'players/ana/storage/bacteria-game.settings'),
        storedValue()
      )
    );
  });

  it('holds while until is ahead', async () => {
    await ban('ana', later(DAY));
    await assertFails(
      setDoc(
        doc(as('ana'), 'players/ana/storage/bacteria-game.settings'),
        storedValue()
      )
    );
  });

  it('lets a player read their own ban, nobody else', async () => {
    await ban('ana', null);
    await assertSucceeds(getDoc(doc(as('ana'), 'bans/ana')));
    await assertFails(getDoc(doc(as('bob'), 'bans/ana')));
    await assertSucceeds(getDoc(doc(asAdmin(), 'bans/ana')));
  });
});

describe('room stubs', () => {
  const answered = async () =>
    seed((db) =>
      setDoc(doc(db, 'rooms/ABCDEF'), {
        host: 'host',
        guest: 'guest',
        offer: 'o',
        answer: 'a',
        createdAt: Timestamp.now(),
        expireAt: later(HOUR),
      })
    );

  const stub = (expireIn = 5 * HOUR) => ({
    host: 'host',
    guest: 'guest',
    createdAt: Timestamp.fromMillis(0),
    expireAt: later(expireIn),
    taken: true,
  });

  it('lets the host replace an answered room with its stub', async () => {
    await answered();
    const createdAt = await readCreatedAt();
    await assertSucceeds(
      setDoc(doc(as('host'), 'rooms/ABCDEF'), { ...stub(), createdAt })
    );
  });

  it('refuses a stub from the guest, a stub living past 6 hours and an answer to a stub', async () => {
    await answered();
    const createdAt = await readCreatedAt();
    await assertFails(
      setDoc(doc(as('guest'), 'rooms/ABCDEF'), { ...stub(), createdAt })
    );
    await assertFails(
      setDoc(doc(as('host'), 'rooms/ABCDEF'), { ...stub(7 * HOUR), createdAt })
    );
    await assertFails(
      setDoc(doc(as('host'), 'rooms/ABCDEF'), {
        ...stub(),
        createdAt,
        offer: 'o',
      })
    );
    await seed((db) =>
      setDoc(doc(db, 'rooms/GHJKLM'), { ...stub(), createdAt })
    );
    await assertFails(
      updateDoc(doc(as('other'), 'rooms/GHJKLM'), {
        guest: 'other',
        answer: 'a',
      })
    );
  });

  async function readCreatedAt(): Promise<Timestamp> {
    let createdAt = Timestamp.now();
    await env.withSecurityRulesDisabled(async (context) => {
      const snapshot = await getDoc(
        doc(context.firestore() as unknown as Firestore, 'rooms/ABCDEF')
      );
      createdAt = snapshot.get('createdAt') as Timestamp;
    });
    return createdAt;
  }
});

describe('profiles', () => {
  it('takes the gallery and board opt-ins as booleans', async () => {
    await assertSucceeds(
      setDoc(
        doc(as('ana'), 'profiles/ana'),
        profile({ publicName: true, galleryOptOut: false, boardOptOut: true })
      )
    );
    await assertFails(
      setDoc(doc(as('ana'), 'profiles/ana'), profile({ publicName: 'yes' }))
    );
    await assertFails(
      setDoc(doc(as('ana'), 'profiles/ana'), profile({ admin: true }))
    );
  });

  it('lists profiles for the owner only', async () => {
    await assertFails(
      getDocs(query(collection(as('ana'), 'profiles'), limit(5)))
    );
    await assertSucceeds(
      getDocs(query(collection(asAdmin(), 'profiles'), limit(5)))
    );
  });
});

describe('declared attempts', () => {
  const attempt = () => ({ at: serverTimestamp(), expireAt: later(31 * DAY) });
  const daily = (n: number) => `d_${today()}_${n}`;
  const run = (r: number, i: number) =>
    `e_${today().replaceAll('-', '')}${r}_${i}`;

  it('takes three daily attempts of today, in order', async () => {
    const db = as('ana');
    await assertFails(
      setDoc(doc(db, `players/ana/attempts/${daily(2)}`), attempt())
    );
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${daily(1)}`), attempt())
    );
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${daily(2)}`), attempt())
    );
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${daily(3)}`), attempt())
    );
    await assertFails(
      setDoc(doc(db, `players/ana/attempts/${daily(4)}`), attempt())
    );
  });

  it('refuses an expiry shorter than 30 days, which TTL would turn into another try', async () => {
    const db = as('ana');
    for (const expireAt of [later(60_000), later(29 * DAY)]) {
      await assertFails(
        setDoc(doc(db, `players/ana/attempts/${daily(1)}`), {
          at: serverTimestamp(),
          expireAt,
        })
      );
    }
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${daily(1)}`), {
        at: serverTimestamp(),
        expireAt: later(30 * DAY + HOUR),
      })
    );
  });

  it('refuses another day, a client time, a long expiry, a second write and another player', async () => {
    const db = as('ana');
    await assertFails(
      setDoc(doc(db, 'players/ana/attempts/d_2020-01-01_1'), attempt())
    );
    await assertFails(
      setDoc(doc(db, `players/ana/attempts/${daily(1)}`), {
        at: Timestamp.now(),
        expireAt: later(DAY),
      })
    );
    await assertFails(
      setDoc(doc(db, `players/ana/attempts/${daily(1)}`), {
        at: serverTimestamp(),
        expireAt: later(40 * DAY),
      })
    );
    await assertFails(
      setDoc(doc(as('bob'), `players/ana/attempts/${daily(1)}`), attempt())
    );
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${daily(1)}`), attempt())
    );
    await assertFails(
      updateDoc(doc(db, `players/ana/attempts/${daily(1)}`), {
        expireAt: later(DAY),
      })
    );
    await assertFails(deleteDoc(doc(db, `players/ana/attempts/${daily(1)}`)));
  });

  it('starts five endless runs a day, each match after the one before', async () => {
    const db = as('ana');
    await assertFails(
      setDoc(doc(db, `players/ana/attempts/${run(2, 0)}`), attempt())
    );
    await assertFails(
      setDoc(doc(db, `players/ana/attempts/${run(1, 1)}`), attempt())
    );
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${run(1, 0)}`), attempt())
    );
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${run(1, 1)}`), attempt())
    );
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${run(1, 2)}`), attempt())
    );
    await assertFails(
      setDoc(doc(db, `players/ana/attempts/${run(1, 4)}`), attempt())
    );
    await assertSucceeds(
      setDoc(doc(db, `players/ana/attempts/${run(2, 0)}`), attempt())
    );
    await assertFails(
      setDoc(doc(db, `players/ana/attempts/${run(6, 0)}`), attempt())
    );
  });

  it('lets a run go on past midnight', async () => {
    await seed((db) =>
      setDoc(doc(db, 'players/ana/attempts/e_202001011_7'), {
        at: Timestamp.now(),
        expireAt: later(DAY),
      })
    );
    await assertSucceeds(
      setDoc(doc(as('ana'), 'players/ana/attempts/e_202001011_8'), attempt())
    );
    await assertFails(
      setDoc(doc(as('ana'), 'players/ana/attempts/e_202001011_0'), attempt())
    );
  });
});

describe('replay submissions', () => {
  const submission = (extra: Record<string, unknown> = {}) => ({
    uid: 'ana',
    bytes: Bytes.fromUint8Array(new Uint8Array([1, 2, 3])),
    hint: 42,
    createdAt: serverTimestamp(),
    expireAt: later(DAY),
    ...extra,
  });

  it('takes a submission of the writer', async () => {
    await assertSucceeds(
      setDoc(doc(as('ana'), 'replaySubmissions/s1'), submission())
    );
  });

  it.each([
    ['another uid', { uid: 'bob' }],
    ['a hint above 100', { hint: 101 }],
    ['a client time', { createdAt: Timestamp.now() }],
    ['a far expiry', { expireAt: later(3 * DAY) }],
    [
      'bytes over the cap',
      { bytes: Bytes.fromUint8Array(new Uint8Array(600_001)) },
    ],
    ['an unknown field', { kind: 'daily' }],
    ['an attempt that was never declared', { attempt: `d_${today()}_1` }],
  ])('refuses %s', async (_, extra) => {
    await assertFails(
      setDoc(doc(as('ana'), 'replaySubmissions/s1'), submission(extra))
    );
  });

  it('takes a declared attempt of the writer', async () => {
    await seed((db) =>
      setDoc(doc(db, `players/ana/attempts/d_${today()}_1`), {
        at: Timestamp.now(),
        expireAt: later(DAY),
      })
    );
    await assertSucceeds(
      setDoc(
        doc(as('ana'), 'replaySubmissions/s1'),
        submission({ attempt: `d_${today()}_1` })
      )
    );
  });

  it('lets nobody read a submission', async () => {
    await seed((db) => setDoc(doc(db, 'replaySubmissions/s1'), { uid: 'ana' }));
    await assertFails(getDoc(doc(as('ana'), 'replaySubmissions/s1')));
  });
});

describe('replay commands', () => {
  const command = (uid: string, type: string) => ({
    uid,
    type,
    replayId: 'l_abc123',
    createdAt: serverTimestamp(),
    expireAt: later(DAY),
  });

  it('lets any player remove, and pins the writer', async () => {
    await assertSucceeds(
      setDoc(doc(as('ana'), 'replayCommands/c1'), command('ana', 'remove'))
    );
    await assertFails(
      setDoc(doc(as('ana'), 'replayCommands/c2'), command('bob', 'remove'))
    );
  });

  it('leaves curation to the owner', async () => {
    await assertFails(
      setDoc(doc(as('ana'), 'replayCommands/c1'), command('ana', 'feature'))
    );
    await assertFails(
      setDoc(
        doc(
          as('ana', { admin: true, email_verified: true }),
          'replayCommands/c1'
        ),
        command('ana', 'feature')
      )
    );
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'replayCommands/c1'), command('owner', 'feature'))
    );
  });

  it('lets the writer read the result, nobody else', async () => {
    await seed((db) =>
      setDoc(doc(db, 'replayCommands/c1'), { uid: 'ana', result: { ok: true } })
    );
    await assertSucceeds(getDoc(doc(as('ana'), 'replayCommands/c1')));
    await assertFails(getDoc(doc(as('bob'), 'replayCommands/c1')));
  });
});

describe('replays', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'replays/l_1'), {
        players: ['ana'],
        createdAt: Timestamp.now(),
      });
      await setDoc(doc(db, 'replays/l_1/blob/data'), { size: 3 });
    });
  });

  it('shows a replay and its blob to its players only', async () => {
    await assertSucceeds(getDoc(doc(as('ana'), 'replays/l_1')));
    await assertSucceeds(getDoc(doc(as('ana'), 'replays/l_1/blob/data')));
    await assertFails(getDoc(doc(as('bob'), 'replays/l_1')));
    await assertFails(getDoc(doc(as('bob'), 'replays/l_1/blob/data')));
  });

  it('lists only the player own replays, 50 at a time', async () => {
    const replays = collection(as('ana'), 'replays');
    await assertSucceeds(
      getDocs(
        query(replays, where('players', 'array-contains', 'ana'), limit(50))
      )
    );
    await assertFails(
      getDocs(
        query(replays, where('players', 'array-contains', 'ana'), limit(51))
      )
    );
    await assertFails(getDocs(query(replays, limit(10))));
  });

  it('lets no client write replays or read what the functions keep', async () => {
    await assertFails(
      setDoc(doc(as('ana'), 'replays/l_2'), { players: ['ana'] })
    );
    for (const path of [
      'publicReplays/p1',
      'limits/ana',
      'counters/2026-10-24',
      'stats/accounts',
      'dailyRuns/x',
      'endlessRuns/x',
      'pairs/x',
      'rankedReplays/x',
      'rankedRooms/x',
      'banTombstones/x',
    ]) {
      await assertFails(getDoc(doc(as('ana'), path)));
      await assertFails(setDoc(doc(as('ana'), path), { x: 1 }));
    }
  });

  it('shows the runners-up and the statistics to the owner only', async () => {
    for (const path of [
      'replayCandidates/2026-10-24',
      'levelStats/x',
      'adminStats/now',
    ]) {
      await assertFails(getDoc(doc(as('ana'), path)));
      await assertSucceeds(getDoc(doc(asAdmin(), path)));
    }
  });
});

describe('leaderboards', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'boards/xp'), { rows: [] });
      await setDoc(doc(db, 'boards/xp/entries/e1'), {
        status: 'counted',
        sort: 5,
      });
      await setDoc(doc(db, 'boards/xp/entries/e2'), {
        status: 'hidden',
        sort: 9,
      });
      await setDoc(doc(db, 'boardMembers/ana'), { entryIds: { xp: 'e1' } });
    });
  });

  it('shows a board and its visible entries to anyone signed in', async () => {
    const db = as('ana');
    await assertSucceeds(getDoc(doc(db, 'boards/xp')));
    await assertSucceeds(getDoc(doc(db, 'boards/xp/entries/e1')));
    await assertFails(getDoc(doc(db, 'boards/xp/entries/e2')));
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore() as unknown as Firestore,
          'boards/xp'
        )
      )
    );
  });

  it('pages and counts only the visible statuses', async () => {
    const entries = collection(as('ana'), 'boards/xp/entries');
    const visible = where('status', 'in', [
      'counted',
      'verified',
      'provisional',
      'stale',
    ]);
    await assertSucceeds(getDocs(query(entries, visible, limit(25))));
    await assertSucceeds(
      getCountFromServer(query(entries, visible, where('sort', '>', 3)))
    );
    await assertFails(getDocs(query(entries, limit(25))));
    await assertSucceeds(
      getDocs(query(collection(asAdmin(), 'boards/xp/entries'), limit(25)))
    );
  });

  it('ties entries to a player for that player and the owner only', async () => {
    await assertSucceeds(getDoc(doc(as('ana'), 'boardMembers/ana')));
    await assertFails(getDoc(doc(as('bob'), 'boardMembers/ana')));
    await assertSucceeds(getDoc(doc(asAdmin(), 'boardMembers/ana')));
  });

  it('lets no client write a board', async () => {
    await assertFails(
      setDoc(doc(as('ana'), 'boards/xp/entries/e3'), { status: 'counted' })
    );
    await assertFails(setDoc(doc(as('ana'), 'boardMembers/ana'), { x: 1 }));
  });
});

describe('notices', () => {
  it('lets a player read and dismiss their own', async () => {
    await seed((db) =>
      setDoc(doc(db, 'players/ana/notices/n1'), { type: 'banned' })
    );
    await assertSucceeds(getDoc(doc(as('ana'), 'players/ana/notices/n1')));
    await assertFails(getDoc(doc(as('bob'), 'players/ana/notices/n1')));
    await assertFails(
      setDoc(doc(as('ana'), 'players/ana/notices/n2'), { type: 'unbanned' })
    );
    await assertSucceeds(deleteDoc(doc(as('ana'), 'players/ana/notices/n1')));
  });
});

describe('admin commands', () => {
  const command = (type: string, extra: Record<string, unknown> = {}) => ({
    uid: 'owner',
    type,
    target: { uid: 'ana' },
    reason: 'offensive name',
    args: {},
    createdAt: serverTimestamp(),
    expireAt: later(DAY),
    ...extra,
  });

  it('takes a command of the owner', async () => {
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'adminCommands/c1'), command('profile.reset'))
    );
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'adminCommands/c2'), {
        uid: 'owner',
        type: 'stats.refresh',
        target: null,
        args: {},
        createdAt: serverTimestamp(),
        expireAt: later(DAY),
      })
    );
  });

  it('wants a target and args, and no target for statistics', async () => {
    const without = (key: string) =>
      Object.fromEntries(
        Object.entries(command('profile.reset')).filter(([k]) => k !== key)
      );
    const noTarget = without('target');
    const noArgs = without('args');
    await assertFails(setDoc(doc(asAdmin(), 'adminCommands/c1'), noTarget));
    await assertFails(setDoc(doc(asAdmin(), 'adminCommands/c1'), noArgs));
    await assertFails(
      setDoc(doc(asAdmin(), 'adminCommands/c1'), command('stats.recount'))
    );
    await assertFails(
      setDoc(
        doc(asAdmin(), 'adminCommands/c1'),
        command('profile.reset', { target: null })
      )
    );
  });

  it('refuses players, other writers, unknown types and missing reasons', async () => {
    await assertFails(
      setDoc(doc(as('ana'), 'adminCommands/c1'), command('profile.reset'))
    );
    await assertFails(
      setDoc(
        doc(asAdmin(), 'adminCommands/c1'),
        command('profile.reset', { uid: 'ana' })
      )
    );
    await assertFails(
      setDoc(doc(asAdmin(), 'adminCommands/c1'), command('player.delete'))
    );
    await assertFails(
      setDoc(
        doc(asAdmin(), 'adminCommands/c1'),
        command('player.unban', { reason: '' })
      )
    );
  });

  it('needs a sign-in within the hour for destructive commands', async () => {
    const stale = asAdmin('owner', 2 * 3600);
    await assertFails(
      setDoc(doc(stale, 'adminCommands/c1'), command('player.ban'))
    );
    await assertSucceeds(
      setDoc(doc(stale, 'adminCommands/c2'), command('player.unban'))
    );
  });

  it('lets the owner read the audit', async () => {
    await seed((db) => setDoc(doc(db, 'adminAudit/a1'), { ok: true }));
    await assertFails(getDoc(doc(as('ana'), 'adminAudit/a1')));
    await assertSucceeds(getDoc(doc(asAdmin(), 'adminAudit/a1')));
  });
});

/**
 * The rules hold copies of constants the game and the functions keep in
 * code. Each is checked against its source here, so a constant changed in
 * one place fails a test.
 */
describe('parity with the code', () => {
  let engine: Engine;

  beforeAll(async () => {
    engine = await loadEngine();
  });

  const adminCommand = (type: string) =>
    type.startsWith('stats.')
      ? {
          uid: 'owner',
          type,
          target: null,
          args: {},
          createdAt: serverTimestamp(),
          expireAt: later(DAY),
        }
      : {
          uid: 'owner',
          type,
          target: { uid: 'ana' },
          reason: 'a reason',
          args: {},
          createdAt: serverTimestamp(),
          expireAt: later(DAY),
        };

  it('takes every ADMIN_COMMAND_TYPES type from an owner signed in just now', async () => {
    for (const [index, type] of engine.ADMIN_COMMAND_TYPES.entries()) {
      await assertSucceeds(
        setDoc(doc(asAdmin(), `adminCommands/f${index}`), adminCommand(type))
      );
    }
  });

  it('wants a recent sign-in for exactly the DESTRUCTIVE_COMMAND_TYPES', async () => {
    const stale = asAdmin('owner', (2 * HOUR) / 1000);
    for (const [index, type] of engine.ADMIN_COMMAND_TYPES.entries()) {
      const write = setDoc(
        doc(stale, `adminCommands/s${index}`),
        adminCommand(type)
      );
      if (engine.DESTRUCTIVE_COMMAND_TYPES.includes(type)) {
        await assertFails(write);
      } else {
        await assertSucceeds(write);
      }
    }
  });

  it("keeps a declared attempt as long as the game's attemptExpireAt asks", async () => {
    await assertSucceeds(
      setDoc(doc(as('ana'), `players/ana/attempts/d_${today()}_1`), {
        at: serverTimestamp(),
        expireAt: Timestamp.fromMillis(engine.attemptExpireAt(Date.now())),
      })
    );
  });

  it('caps the submitted bytes at MAX_SUBMISSION_BYTES', async () => {
    const submission = (size: number) => ({
      uid: 'ana',
      bytes: Bytes.fromUint8Array(new Uint8Array(size)),
      hint: 0,
      createdAt: serverTimestamp(),
      expireAt: later(DAY),
    });
    expect(MAX_SUBMISSION_BYTES).toBe(engine.MAX_PACKED_BYTES);
    await assertSucceeds(
      setDoc(
        doc(as('ana'), 'replaySubmissions/max'),
        submission(MAX_SUBMISSION_BYTES)
      )
    );
    await assertFails(
      setDoc(
        doc(as('ana'), 'replaySubmissions/over'),
        submission(MAX_SUBMISSION_BYTES + 1)
      )
    );
  });

  it("takes a replay id exactly when the engine's REPLAY_ID does", async () => {
    const ids = [
      engine.onlineReplayId('ABCDEF', 1, 7),
      'o_0123456789abcdef',
      'o_0123456789abcde',
      'o_0123456789ABCDEF',
      'o_0123456789abcdef0',
      'l_abc123',
      `l_${'a'.repeat(40)}`,
      `l_${'a'.repeat(41)}`,
      'l_',
      'l_a-b',
      'x_abc',
    ];
    for (const [index, replayId] of ids.entries()) {
      const write = setDoc(doc(as('ana'), `replayCommands/r${index}`), {
        uid: 'ana',
        type: 'remove',
        replayId,
        createdAt: serverTimestamp(),
        expireAt: later(DAY),
      });
      if (engine.REPLAY_ID.test(replayId)) {
        await assertSucceeds(write);
      } else {
        await assertFails(write);
      }
    }
  });
});
