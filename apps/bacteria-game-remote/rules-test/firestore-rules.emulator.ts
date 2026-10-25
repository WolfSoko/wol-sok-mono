import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Bytes,
  collection,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The game's Firestore rules (`../firestore.rules`) on the emulator: what
 * ADR 0011 and 0012 let a client write and read - the replays, the room
 * stub, the owner's commands and the ban check on every client write.
 */
let env: RulesTestEnvironment;

const HOUR = 3_600_000;
const OWNER_TOKEN = {
  admin: true,
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
};

beforeAll(async () => {
  // Every refused write would log its denial - the refusals are expected.
  setLogLevel('silent');
  env = await initializeTestEnvironment({
    projectId: 'demo-bacteria-rules',
    firestore: {
      rules: readFileSync(join(__dirname, '../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

const db = (uid: string, token: object = {}): Firestore =>
  env.authenticatedContext(uid, token).firestore() as unknown as Firestore;

/** Writes past the rules - what the functions or an earlier test did. */
function seed(path: string, data: object): Promise<void> {
  return env.withSecurityRulesDisabled((context: RulesTestContext) =>
    setDoc(doc(context.firestore() as unknown as Firestore, path), data)
  );
}

const inADay = () => Timestamp.fromMillis(Date.now() + 24 * HOUR);

function submission(uid: string, extra: object = {}) {
  return {
    uid,
    bytes: Bytes.fromUint8Array(new Uint8Array([1, 2, 3])),
    hint: 50,
    createdAt: serverTimestamp(),
    expireAt: inADay(),
    ...extra,
  };
}

function command(uid: string, type: string, extra: object = {}) {
  return {
    uid,
    type,
    replayId: 'l_abc',
    createdAt: serverTimestamp(),
    expireAt: inADay(),
    ...extra,
  };
}

describe('declared attempts', () => {
  // The rules compare with the server's UTC day, as the client declares.
  const today = () => new Date().toISOString().slice(0, 10);
  const yesterday = () =>
    new Date(Date.now() - 24 * HOUR).toISOString().slice(0, 10);
  const compact = (day: string) => day.replaceAll('-', '');
  const declaration = (extra: object = {}) => ({
    at: serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + 31 * 24 * HOUR),
    ...extra,
  });
  const declare = (uid: string, id: string, data: object = declaration()) =>
    setDoc(doc(db(uid), `players/${uid}/attempts/${id}`), data);

  it("takes today's daily attempts in order, three at most", async () => {
    const day = today();
    await assertFails(declare('ada', `d_${day}_2`));
    await assertSucceeds(declare('ada', `d_${day}_1`));
    await assertSucceeds(declare('ada', `d_${day}_2`));
    await assertSucceeds(declare('ada', `d_${day}_3`));
    await assertFails(declare('ada', `d_${day}_4`));
  });

  it('refuses another day, a second write and somebody else', async () => {
    await assertFails(declare('ada', `d_${yesterday()}_1`));
    await assertSucceeds(declare('ada', `d_${today()}_1`));
    await assertFails(declare('ada', `d_${today()}_1`));
    await assertFails(
      setDoc(
        doc(db('bob'), `players/ada/attempts/d_${today()}_2`),
        declaration()
      )
    );
    await seed('bans/eve', { until: null });
    await assertFails(declare('eve', `d_${today()}_1`));
  });

  it('wants the server time, an expiry in 28 to 32 days and nothing else', async () => {
    const id = `d_${today()}_1`;
    await assertFails(declare('ada', id, declaration({ at: Timestamp.now() })));
    await assertFails(
      declare(
        'ada',
        id,
        declaration({
          expireAt: Timestamp.fromMillis(Date.now() + 33 * 24 * HOUR),
        })
      )
    );
    await assertFails(
      declare(
        'ada',
        id,
        declaration({ expireAt: Timestamp.fromMillis(Date.now() + 1_000) })
      )
    );
    await assertFails(declare('ada', id, declaration({ seed: 1 })));
    await assertFails(declare('ada', 'x_1', declaration()));
  });

  it('refuses an expiry shorter than 28 days, which TTL would turn into another try', async () => {
    const id = `d_${today()}_1`;
    for (const ms of [60_000, 27 * 24 * HOUR]) {
      await assertFails(
        declare(
          'ada',
          id,
          declaration({ expireAt: Timestamp.fromMillis(Date.now() + ms) })
        )
      );
    }
    // A device whose clock runs almost 3 days slow still declares.
    await assertSucceeds(
      declare(
        'ada',
        id,
        declaration({
          expireAt: Timestamp.fromMillis(
            Date.now() - (3 * 24 - 1) * HOUR + 31 * 24 * HOUR
          ),
        })
      )
    );
  });

  it("takes an endless run's matches in order, from today's runs", async () => {
    const run1 = `${compact(today())}1`;
    const run2 = `${compact(today())}2`;
    await assertFails(declare('ada', `e_${run1}_1`));
    await assertFails(declare('ada', `e_${run2}_0`));
    await assertSucceeds(declare('ada', `e_${run1}_0`));
    await assertSucceeds(declare('ada', `e_${run1}_1`));
    await assertSucceeds(declare('ada', `e_${run2}_0`));
    await assertFails(declare('ada', `e_${compact(yesterday())}1_0`));
    await assertFails(declare('ada', `e_${compact(today())}6_0`));
  });

  it('lets a run go on past midnight', async () => {
    const run = `${compact(yesterday())}1`;
    await seed(`players/ada/attempts/e_${run}_0`, { at: Timestamp.now() });
    await assertSucceeds(declare('ada', `e_${run}_1`));
  });

  it('lets only the player read them, and nobody change them', async () => {
    const id = `d_${today()}_1`;
    await assertSucceeds(declare('ada', id));
    await assertSucceeds(getDoc(doc(db('ada'), `players/ada/attempts/${id}`)));
    await assertFails(getDoc(doc(db('bob'), `players/ada/attempts/${id}`)));
    await assertFails(
      updateDoc(doc(db('ada'), `players/ada/attempts/${id}`), {
        at: serverTimestamp(),
      })
    );
  });
  it('lets a player declare a void daily attempt again, nothing else', async () => {
    const day = today();
    const voided = { at: Timestamp.now(), void: true, voidReason: 'cap' };
    await seed(`players/ada/attempts/d_${day}_1`, voided);
    // A whole new declaration in its place: the void marker goes.
    await assertFails(
      updateDoc(doc(db('ada'), `players/ada/attempts/d_${day}_1`), {
        at: serverTimestamp(),
      })
    );
    await assertFails(
      setDoc(doc(db('bob'), `players/ada/attempts/d_${day}_1`), declaration())
    );
    await assertSucceeds(declare('ada', `d_${day}_1`));
    await assertFails(declare('ada', `d_${day}_1`));
    // Only on its day, and never an endless match.
    await seed(`players/ada/attempts/d_${yesterday()}_1`, voided);
    await assertFails(declare('ada', `d_${yesterday()}_1`));
    const run = `${compact(day)}1`;
    await seed(`players/ada/attempts/e_${run}_0`, voided);
    await assertFails(declare('ada', `e_${run}_0`));
    await seed('bans/eve', { until: null });
    await seed(`players/eve/attempts/d_${day}_1`, voided);
    await assertFails(declare('eve', `d_${day}_1`));
  });
});

describe('replaySubmissions', () => {
  const add = (writer: string, data: object) =>
    setDoc(doc(collection(db(writer), 'replaySubmissions')), data);

  it("takes a player's own submission", async () => {
    await assertSucceeds(add('ada', submission('ada')));
  });

  it("refuses one in somebody else's name, or anonymous", async () => {
    await assertFails(add('ada', submission('bob')));
    await assertFails(
      setDoc(
        doc(
          collection(
            env.unauthenticatedContext().firestore() as unknown as Firestore,
            'replaySubmissions'
          )
        ),
        submission('ada')
      )
    );
  });

  it('wants the server time, a short expiry, a small blob and a whole hint', async () => {
    await assertFails(
      add('ada', submission('ada', { createdAt: Timestamp.now() }))
    );
    await assertFails(
      add(
        'ada',
        submission('ada', {
          expireAt: Timestamp.fromMillis(Date.now() + 72 * HOUR),
        })
      )
    );
    await assertFails(
      add(
        'ada',
        submission('ada', {
          bytes: Bytes.fromUint8Array(new Uint8Array(600_001)),
        })
      )
    );
    await assertFails(add('ada', submission('ada', { hint: 101 })));
    await assertFails(add('ada', submission('ada', { hint: 4.5 })));
    await assertFails(add('ada', submission('ada', { extra: true })));
  });

  it('takes a ranked attempt only once it was declared', async () => {
    const attempt = 'd_2026-10-24_1';
    await assertFails(add('ada', submission('ada', { attempt })));
    await seed(`players/ada/attempts/${attempt}`, { at: Timestamp.now() });
    await assertSucceeds(add('ada', submission('ada', { attempt })));
  });

  it('lets nobody read them', async () => {
    await seed('replaySubmissions/s1', { uid: 'ada' });
    await assertFails(getDoc(doc(db('ada'), 'replaySubmissions/s1')));
  });
});

describe('replayCommands', () => {
  const add = (writer: string, data: object, token: object = {}) =>
    setDoc(doc(db(writer, token), 'replayCommands/c1'), data);

  it('takes `remove` from any player, in their own name', async () => {
    await assertSucceeds(add('ada', command('ada', 'remove')));
    await assertFails(add('ada', command('bob', 'remove')));
  });

  it("takes the gallery's types only from the owner", async () => {
    for (const type of ['feature', 'unfeature', 'anonymise']) {
      await assertFails(add('ada', command('ada', type)));
    }
    await assertFails(
      add('own', command('own', 'feature'), {
        ...OWNER_TOKEN,
        firebase: { sign_in_provider: 'anonymous' },
      })
    );
    await assertFails(
      add('own', command('own', 'feature'), {
        ...OWNER_TOKEN,
        email_verified: false,
      })
    );
    await assertSucceeds(add('own', command('own', 'feature'), OWNER_TOKEN));
  });

  it('refuses an unknown type or a strange replay id', async () => {
    await assertFails(add('ada', command('ada', 'delete')));
    await assertFails(
      add('ada', command('ada', 'remove', { replayId: '../replays/x' }))
    );
  });

  it('lets only the writer read a command back', async () => {
    await seed('replayCommands/c2', { uid: 'ada', type: 'remove' });
    await assertSucceeds(getDoc(doc(db('ada'), 'replayCommands/c2')));
    await assertFails(getDoc(doc(db('bob'), 'replayCommands/c2')));
  });
});

describe('replays', () => {
  beforeEach(async () => {
    await seed('replays/r1', {
      players: ['ada', 'bob'],
      createdAt: Timestamp.now(),
    });
    await seed('replays/r1/blob/data', { size: 3 });
  });

  it('lets its players read it and its bytes, nobody else', async () => {
    await assertSucceeds(getDoc(doc(db('ada'), 'replays/r1')));
    await assertSucceeds(getDoc(doc(db('bob'), 'replays/r1/blob/data')));
    await assertFails(getDoc(doc(db('eve'), 'replays/r1')));
    await assertFails(getDoc(doc(db('eve'), 'replays/r1/blob/data')));
  });

  it('lets the owner look one up by id, not list them or read the bytes', async () => {
    const owner = db('own', OWNER_TOKEN);
    await assertSucceeds(getDoc(doc(owner, 'replays/r1')));
    await assertFails(getDocs(query(collection(owner, 'replays'), limit(10))));
    await assertFails(getDoc(doc(owner, 'replays/r1/blob/data')));
  });

  it("lists a player's own, 50 at a time", async () => {
    const mine = (n: number) =>
      getDocs(
        query(
          collection(db('ada'), 'replays'),
          where('players', 'array-contains', 'ada'),
          orderBy('createdAt', 'desc'),
          limit(n)
        )
      );
    await assertSucceeds(mine(50));
    await assertFails(mine(51));
    await assertFails(
      getDocs(query(collection(db('ada'), 'replays'), limit(10)))
    );
  });

  it('lets no client write one', async () => {
    await assertFails(
      setDoc(doc(db('ada'), 'replays/r2'), { players: ['ada'] })
    );
    await assertFails(
      updateDoc(doc(db('ada'), 'replays/r1'), { state: 'agreed' })
    );
  });
});

describe('the leaderboards', () => {
  beforeEach(async () => {
    await seed('boards/xp', { rows: [] });
    await seed('boards/xp/entries/e1', { status: 'counted', sort: 5 });
    await seed('boards/xp/entries/e2', { status: 'hidden', sort: 9 });
    await seed('boardMembers/ada', { entryIds: { xp: 'e1' } });
  });

  const visible = ['counted', 'verified', 'provisional', 'stale'];

  it('lets anyone signed in read a top document and page the visible entries', async () => {
    await assertSucceeds(getDoc(doc(db('bob'), 'boards/xp')));
    await assertSucceeds(getDoc(doc(db('bob'), 'boards/xp/entries/e1')));
    await assertSucceeds(
      getDocs(
        query(
          collection(db('bob'), 'boards/xp/entries'),
          where('status', 'in', visible),
          orderBy('sort', 'desc'),
          limit(25)
        )
      )
    );
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore() as unknown as Firestore,
          'boards/xp'
        )
      )
    );
  });

  it('keeps hidden entries from players, not from the owner', async () => {
    await assertFails(getDoc(doc(db('bob'), 'boards/xp/entries/e2')));
    await assertFails(
      getDocs(query(collection(db('bob'), 'boards/xp/entries'), limit(25)))
    );
    await assertSucceeds(
      getDoc(doc(db('own', OWNER_TOKEN), 'boards/xp/entries/e2'))
    );
  });

  it("lets a player read their own membership, nobody else's", async () => {
    await assertSucceeds(getDoc(doc(db('ada'), 'boardMembers/ada')));
    await assertFails(getDoc(doc(db('bob'), 'boardMembers/ada')));
  });

  it('lets no client write a board', async () => {
    await assertFails(setDoc(doc(db('ada'), 'boards/xp'), { rows: [] }));
    await assertFails(
      setDoc(doc(db('ada'), 'boards/xp/entries/e1'), { status: 'counted' })
    );
    await assertFails(setDoc(doc(db('ada'), 'boardMembers/ada'), { xp: {} }));
  });
});

describe('board memberships', () => {
  it("are listed by the owner only, to find an entry's player", async () => {
    await seed('boardMembers/ada', { entryIds: { xp: 'e1' } });
    const byEntry = (uid: string, token?: object) =>
      getDocs(
        query(
          collection(db(uid, token), 'boardMembers'),
          where('entryIds.xp', '==', 'e1')
        )
      );
    await assertSucceeds(byEntry('own', OWNER_TOKEN));
    await assertFails(byEntry('ada'));
  });
});

describe('profiles', () => {
  const profile = (extra: object = {}) => ({
    name: 'Ada',
    motto: '',
    avatar: { kind: 'preset', id: 1 },
    shareStatus: true,
    updatedAt: serverTimestamp(),
    ...extra,
  });

  it('take the public-name and opt-out flags, as booleans only', async () => {
    await assertSucceeds(
      setDoc(
        doc(db('ada'), 'profiles/ada'),
        profile({ publicName: true, galleryOptOut: false, boardOptOut: true })
      )
    );
    await assertFails(
      setDoc(doc(db('ada'), 'profiles/ada'), profile({ publicName: 'yes' }))
    );
    await assertFails(
      setDoc(doc(db('ada'), 'profiles/ada'), profile({ admin: true }))
    );
  });

  it('are listed by the owner only', async () => {
    await seed('profiles/ada', { name: 'Ada' });
    await assertSucceeds(
      getDocs(collection(db('own', OWNER_TOKEN), 'profiles'))
    );
    await assertFails(getDocs(collection(db('ada'), 'profiles')));
    await assertSucceeds(getDoc(doc(db('bob'), 'profiles/ada')));
  });
});

describe('bans', () => {
  it('lets a player read their own ban, not another', async () => {
    await seed('bans/ada', { until: null });
    await assertSucceeds(getDoc(doc(db('ada'), 'bans/ada')));
    await assertFails(getDoc(doc(db('bob'), 'bans/ada')));
    await assertSucceeds(getDoc(doc(db('own', OWNER_TOKEN), 'bans/ada')));
  });

  it('are listed by the owner only', async () => {
    await seed('bans/ada', { until: null });
    await assertSucceeds(getDocs(collection(db('own', OWNER_TOKEN), 'bans')));
    await assertFails(getDocs(collection(db('ada'), 'bans')));
  });
});

describe('adminCommands', () => {
  /** The owner, signed in just now - as destructive types want. */
  const fresh = () => ({
    ...OWNER_TOKEN,
    auth_time: Math.floor(Date.now() / 1000),
  });
  const adminCommand = (extra: object = {}) => ({
    uid: 'own',
    type: 'player.ban',
    target: { uid: 'eve' },
    reason: 'cheats',
    args: { until: null, reason: 'cheating' },
    createdAt: serverTimestamp(),
    expireAt: inADay(),
    ...extra,
  });
  let sent = 0;
  // A new document each time: a command is created, never rewritten.
  const send = (data: object, token: object = fresh(), uid = 'own') =>
    setDoc(doc(db(uid, token), `adminCommands/a${++sent}`), data);

  it('takes a command from the owner, in their own name', async () => {
    await assertSucceeds(send(adminCommand()));
    await assertFails(send(adminCommand({ uid: 'bob' })));
    await assertFails(
      send(
        adminCommand({ uid: 'eve' }),
        { auth_time: fresh().auth_time },
        'eve'
      )
    );
  });

  it('wants the claim on a verified Google account', async () => {
    const { auth_time } = fresh();
    await assertFails(
      send(adminCommand(), { ...OWNER_TOKEN, auth_time, admin: false })
    );
    await assertFails(
      send(adminCommand(), { ...OWNER_TOKEN, auth_time, email_verified: false })
    );
    await assertFails(
      send(adminCommand(), {
        ...OWNER_TOKEN,
        auth_time,
        firebase: { sign_in_provider: 'anonymous' },
      })
    );
  });

  it('takes feature toggles as booleans, with a reason', async () => {
    const toggles = (values: unknown, extra: object = {}) =>
      adminCommand({
        type: 'toggles.set',
        target: null,
        args: { values },
        ...extra,
      });
    await assertSucceeds(
      send(toggles({ rankedDaily: false, matchmaking: true }))
    );
    await assertFails(send(toggles({})));
    await assertFails(send(toggles({ gallery: true })));
    await assertFails(send(toggles({ leaderboards: 'off' })));
    await assertFails(send(toggles({ rankedDaily: false }, { reason: '' })));
    await assertFails(
      send(toggles({ rankedDaily: false }, { target: { uid: 'eve' } }))
    );
    // It changes the game for everybody: a recent sign-in too.
    await assertFails(
      send(toggles({ rankedDaily: false }), {
        ...OWNER_TOKEN,
        auth_time: Math.floor((Date.now() - 2 * HOUR) / 1000),
      })
    );
  });

  it('wants a recent sign-in for destructive types only', async () => {
    const stale = {
      ...OWNER_TOKEN,
      auth_time: Math.floor((Date.now() - 2 * HOUR) / 1000),
    };
    await assertFails(send(adminCommand(), stale));
    await assertFails(
      send(adminCommand({ type: 'profile.reset', args: {} }), stale)
    );
    await assertSucceeds(
      send(adminCommand({ type: 'player.unban', args: {} }), stale)
    );
    await assertSucceeds(
      send(
        adminCommand({
          type: 'stats.refresh',
          target: null,
          reason: '',
          args: {},
        }),
        stale
      )
    );
  });

  it('wants the server time, a short expiry and no extra field', async () => {
    await assertFails(send(adminCommand({ createdAt: Timestamp.now() })));
    await assertFails(
      send(
        adminCommand({
          expireAt: Timestamp.fromMillis(Date.now() + 3 * 24 * HOUR),
        })
      )
    );
    await assertFails(send(adminCommand({ result: { ok: true } })));
    await assertFails(send(adminCommand({ type: 'player.delete' })));
  });

  it('wants a reason, but not for statistics', async () => {
    await assertFails(send(adminCommand({ reason: '' })));
    await assertFails(send(adminCommand({ reason: '   ' })));
    await assertFails(send(adminCommand({ reason: 'x'.repeat(201) })));
    const { reason: _reason, ...noReason } = adminCommand({
      type: 'stats.recount',
      target: null,
      args: {},
    });
    await assertSucceeds(send(noReason));
  });

  it("checks each type's target", async () => {
    const entry = { boardId: 'daily-2026-11-03', entryId: 'e_1-x' };
    await assertSucceeds(send(adminCommand({ target: entry })));
    await assertFails(send(adminCommand({ target: { uid: 'e/ve' } })));
    await assertFails(
      send(adminCommand({ target: { boardId: 'week', entryId: 'e1' } }))
    );
    await assertFails(send(adminCommand({ target: null })));
    await assertFails(
      send(adminCommand({ type: 'player.unban', target: entry, args: {} }))
    );
    await assertFails(
      send(
        adminCommand({
          type: 'board.verify',
          target: { boardId: 'xp', entryId: 'e1' },
          args: {},
        })
      )
    );
    await assertSucceeds(
      send(
        adminCommand({
          type: 'board.verify',
          target: { boardId: 'endless', entryId: 'e1' },
          args: {},
        })
      )
    );
    await assertFails(
      send(
        adminCommand({
          type: 'stats.refresh',
          target: { uid: 'eve' },
          args: {},
        })
      )
    );
  });

  it("checks each type's arguments", async () => {
    const ban = (args: object) => send(adminCommand({ args }));
    await assertSucceeds(
      ban({
        until: Timestamp.fromMillis(Date.now() + 24 * HOUR),
        reason: 'spam',
      })
    );
    await assertSucceeds(ban({ until: Date.now() + HOUR, reason: 'other' }));
    await assertFails(ban({ until: Date.now() - HOUR, reason: 'other' }));
    await assertFails(ban({ until: null, reason: 'rude' }));
    await assertFails(ban({ until: null }));
    await assertFails(ban({ until: null, reason: 'spam', extra: 1 }));
    const hide = (args: object) =>
      send(
        adminCommand({
          type: 'board.hideEntry',
          target: { boardId: 'xp', entryId: 'e1' },
          args,
        })
      );
    await assertSucceeds(hide({ bar: true }));
    await assertSucceeds(hide({}));
    await assertFails(hide({ bar: 'yes' }));
    await assertFails(
      send(adminCommand({ type: 'player.unban', args: { bar: true } }))
    );
  });

  it("lets the owner read their own commands, nobody else's", async () => {
    await seed('adminCommands/a1', { uid: 'own', type: 'stats.refresh' });
    await assertSucceeds(
      getDoc(doc(db('own', OWNER_TOKEN), 'adminCommands/a1'))
    );
    await assertFails(getDoc(doc(db('ada'), 'adminCommands/a1')));
    await assertFails(
      updateDoc(doc(db('own', fresh()), 'adminCommands/a1'), {
        result: { ok: true },
      })
    );
  });
});

describe('adminAudit', () => {
  it('lets the owner read it, nobody write it', async () => {
    await seed('adminAudit/a1', { by: 'own', type: 'player.ban' });
    await assertSucceeds(getDoc(doc(db('own', OWNER_TOKEN), 'adminAudit/a1')));
    await assertSucceeds(
      getDocs(
        query(
          collection(db('own', OWNER_TOKEN), 'adminAudit'),
          orderBy('at', 'desc'),
          limit(25)
        )
      )
    );
    await assertFails(getDoc(doc(db('ada'), 'adminAudit/a1')));
    await assertFails(
      setDoc(doc(db('own', OWNER_TOKEN), 'adminAudit/a2'), { by: 'own' })
    );
  });
});

describe('adminStats', () => {
  it('lets the owner read it, nobody write it', async () => {
    await seed('adminStats/now', { accounts: 3 });
    await seed('adminStats/h_2026110312', { accounts: 3 });
    await assertSucceeds(getDoc(doc(db('own', OWNER_TOKEN), 'adminStats/now')));
    await assertSucceeds(
      getDocs(
        query(
          collection(db('own', OWNER_TOKEN), 'adminStats'),
          orderBy('at', 'desc'),
          limit(24)
        )
      )
    );
    await assertFails(getDoc(doc(db('ada'), 'adminStats/now')));
    await assertFails(
      setDoc(doc(db('own', OWNER_TOKEN), 'adminStats/now'), { accounts: 9 })
    );
  });
});

describe('levelStats', () => {
  it('lets the owner read it, nobody write it', async () => {
    await seed('levelStats/quarantine_hard_b12_l1', { attempts: 3 });
    await assertSucceeds(
      getDocs(collection(db('own', OWNER_TOKEN), 'levelStats'))
    );
    await assertFails(
      getDoc(doc(db('ada'), 'levelStats/quarantine_hard_b12_l1'))
    );
    await assertFails(
      setDoc(doc(db('own', OWNER_TOKEN), 'levelStats/quarantine_hard_b12_l1'), {
        attempts: 9,
      })
    );
  });
});

describe('the gallery', () => {
  it("lets the owner read a day's runners-up and the public replays, but not their bytes", async () => {
    await seed('replayCandidates/2026-10-25', { done: true });
    await seed('publicReplays/p1', { replayId: 'l_a', removedAt: null });
    await seed('publicReplays/p1/blob/data', { size: 3 });
    const owner = db('own', OWNER_TOKEN);
    await assertSucceeds(getDoc(doc(owner, 'replayCandidates/2026-10-25')));
    await assertFails(getDoc(doc(db('ada'), 'replayCandidates/2026-10-25')));
    await assertSucceeds(getDoc(doc(owner, 'publicReplays/p1')));
    await assertSucceeds(
      getDocs(
        query(
          collection(owner, 'publicReplays'),
          where('removedAt', '==', null),
          orderBy('featuredAt', 'desc')
        )
      )
    );
    await assertFails(getDoc(doc(owner, 'publicReplays/p1/blob/data')));
    await assertFails(getDoc(doc(db('ada'), 'publicReplays/p1')));
    await assertFails(getDocs(collection(db('ada'), 'publicReplays')));
  });
});

describe('notices and moderation', () => {
  it("lets a player read and delete their own notices, nobody else's", async () => {
    await seed('players/ada/notices/n1', { type: 'banned' });
    await assertSucceeds(getDoc(doc(db('ada'), 'players/ada/notices/n1')));
    await assertSucceeds(getDocs(collection(db('ada'), 'players/ada/notices')));
    await assertFails(getDoc(doc(db('bob'), 'players/ada/notices/n1')));
    await assertFails(
      setDoc(doc(db('ada'), 'players/ada/notices/n2'), { type: 'unbanned' })
    );
    await assertSucceeds(
      import('firebase/firestore').then(({ deleteDoc }) =>
        deleteDoc(doc(db('ada'), 'players/ada/notices/n1'))
      )
    );
  });

  it('lets only the owner read the moderation counters', async () => {
    await seed('moderation/ada', { bans: 1 });
    await assertSucceeds(getDoc(doc(db('own', OWNER_TOKEN), 'moderation/ada')));
    await assertFails(getDoc(doc(db('ada'), 'moderation/ada')));
  });
});

describe('the room stub', () => {
  const answered = () => ({
    host: 'ada',
    offer: 'o',
    guest: 'bob',
    answer: 'a',
    createdAt: Timestamp.fromMillis(Date.now() - HOUR),
    expireAt: Timestamp.fromMillis(Date.now() + HOUR),
  });
  const stub = (room: ReturnType<typeof answered>, extra: object = {}) => ({
    host: room.host,
    guest: room.guest,
    createdAt: room.createdAt,
    expireAt: Timestamp.fromMillis(room.createdAt.toMillis() + 6 * HOUR),
    taken: true,
    ...extra,
  });

  it('lets the host swap an answered room for its stub', async () => {
    const room = answered();
    await seed('rooms/ABC234', room);
    await assertSucceeds(setDoc(doc(db('ada'), 'rooms/ABC234'), stub(room)));
  });

  it('refuses the guest, a room not yet answered, a longer life or other players', async () => {
    const room = answered();
    await seed('rooms/ABC234', room);
    await assertFails(setDoc(doc(db('bob'), 'rooms/ABC234'), stub(room)));
    await assertFails(
      setDoc(
        doc(db('ada'), 'rooms/ABC234'),
        stub(room, {
          expireAt: Timestamp.fromMillis(room.createdAt.toMillis() + 7 * HOUR),
        })
      )
    );
    await assertFails(
      setDoc(doc(db('ada'), 'rooms/ABC234'), stub(room, { guest: 'eve' }))
    );
    const open = { ...room, guest: undefined, answer: undefined };
    delete open.guest;
    delete open.answer;
    await seed('rooms/DEF567', open);
    await assertFails(
      setDoc(doc(db('ada'), 'rooms/DEF567'), stub({ ...room, guest: 'bob' }))
    );
  });

  it('lets nobody take the guest seat of a stub', async () => {
    const room = answered();
    await seed('rooms/ABC234', stub(room));
    await assertFails(
      updateDoc(doc(db('eve'), 'rooms/ABC234'), { guest: 'eve', answer: 'a' })
    );
  });

  it('still lets a guest answer an open room', async () => {
    const { guest: _guest, answer: _answer, ...open } = answered();
    await seed('rooms/ABC234', open);
    await assertSucceeds(
      updateDoc(doc(db('bob'), 'rooms/ABC234'), { guest: 'bob', answer: 'a' })
    );
  });
});

describe('a ban', () => {
  /** A write each client path allows, by `uid`. */
  const writes: Record<string, (uid: string) => Promise<void>> = {
    storage: (uid) =>
      setDoc(doc(db(uid), `players/${uid}/storage/bacteria-game.progress`), {
        json: '{}',
        updatedAt: serverTimestamp(),
      }),
    profile: (uid) =>
      setDoc(doc(db(uid), `profiles/${uid}`), {
        name: 'Ada',
        motto: '',
        avatar: { kind: 'preset', id: 1 },
        shareStatus: true,
        updatedAt: serverTimestamp(),
      }),
    room: (uid) =>
      setDoc(doc(db(uid), 'rooms/ABC234'), {
        host: uid,
        offer: 'o',
        createdAt: serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + HOUR),
      }),
    invite: (uid) =>
      setDoc(doc(db(uid), 'invites/abcdefghjkmnpqrstuvw'), {
        from: uid,
        at: serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + HOUR),
      }),
    queue: (uid) =>
      setDoc(doc(db(uid), `queue/${uid}`), {
        since: serverTimestamp(),
        seen: serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + HOUR / 2),
        level: null,
        claim: null,
      }),
    request: (uid) =>
      setDoc(doc(db(uid), `players/someone/requests/${uid}`), {
        at: serverTimestamp(),
      }),
    friend: (uid) =>
      setDoc(doc(db(uid), `players/${uid}/friends/someone`), {
        since: serverTimestamp(),
      }),
    submission: (uid) =>
      setDoc(doc(collection(db(uid), 'replaySubmissions')), submission(uid)),
    command: (uid) =>
      setDoc(doc(db(uid), 'replayCommands/c1'), command(uid, 'remove')),
  };

  for (const [path, write] of Object.entries(writes)) {
    it(`stops a banned player's write: ${path}`, async () => {
      await seed('bans/eve', { until: null });
      await assertFails(write('eve'));
      await assertSucceeds(write('ada'));
    });
  }

  it('ends by itself at its end', async () => {
    await seed('bans/eve', { until: Timestamp.fromMillis(Date.now() + HOUR) });
    await assertFails(writes['profile']('eve'));
    await seed('bans/eve', { until: Timestamp.fromMillis(Date.now() - 1000) });
    await assertSucceeds(writes['profile']('eve'));
  });

  it("stops a banned player's claim on another's queue entry", async () => {
    await seed('queue/ada', { since: Timestamp.now(), claim: null });
    await seed('bans/eve', { until: null });
    const claim = (uid: string) =>
      updateDoc(doc(db(uid), 'queue/ada'), {
        claim: { by: uid, code: 'ABC234' },
      });
    await assertFails(claim('eve'));
    await assertSucceeds(claim('bob'));
  });

  it('still lets a banned player delete their own data', async () => {
    await seed('bans/eve', { until: null });
    await seed('profiles/eve', { name: 'Eve' });
    await assertSucceeds(
      import('firebase/firestore').then(({ deleteDoc }) =>
        deleteDoc(doc(db('eve'), 'profiles/eve'))
      )
    );
  });
});
