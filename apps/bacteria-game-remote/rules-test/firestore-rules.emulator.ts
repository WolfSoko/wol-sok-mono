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

describe('bans', () => {
  it('lets a player read their own ban, not another', async () => {
    await seed('bans/ada', { until: null });
    await assertSucceeds(getDoc(doc(db('ada'), 'bans/ada')));
    await assertFails(getDoc(doc(db('bob'), 'bans/ada')));
    await assertSucceeds(getDoc(doc(db('own', OWNER_TOKEN), 'bans/ada')));
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
