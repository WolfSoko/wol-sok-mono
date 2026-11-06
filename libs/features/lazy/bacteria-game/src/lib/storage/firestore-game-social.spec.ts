import { firstValueFrom } from 'rxjs';
import {
  FAKE_SERVER_TIME,
  FakeFirebase,
  FakeTimestamp,
  SERVER_TIMESTAMP,
  settleSnapshots,
} from '../../testing/fake-firebase-sdk';
import { FirestoreGameSocial, inviteToken } from './firestore-game-social';
import type { QueueEntry } from './game-social';
import { defaultProfile } from '@wolsok/feat-shared-bacteria-engine';

describe('inviteToken', () => {
  it('is twenty letters and digits, a letter per byte', () => {
    expect(inviteToken()).toMatch(/^[a-z2-9]{20}$/);
    expect(inviteToken(new Uint8Array(20))).toBe('a'.repeat(20));
    expect(inviteToken(new Uint8Array(20).fill(255))).toBe('9'.repeat(20));
  });
});

/** The social backend on the fake. */
function socialOf(firestore: FakeFirebase): FirestoreGameSocial {
  return new FirestoreGameSocial(firestore.connection());
}

/** The server's time as the fake stores it. */
const NOW = FakeTimestamp.fromMillis(FAKE_SERVER_TIME);

describe('FirestoreGameSocial profile', () => {
  it('tells no profile until the server says there is none', async () => {
    const firestore = new FakeFirebase();
    firestore.fromCache = true;
    const seen: unknown[] = [];
    socialOf(firestore)
      .watchProfile('ada')
      .subscribe((value) => seen.push(value));
    await settleSnapshots();

    expect(seen).toEqual([]);

    firestore.fromCache = false;
    firestore.resend();
    await settleSnapshots();
    expect(seen).toEqual([null]);

    firestore.docs.set('profiles/ada', { name: 'Ada' });
    firestore.fromCache = true;
    firestore.resend();
    await settleSnapshots();
    expect(seen).toEqual([null, { name: 'Ada' }]);
  });

  it('writes only the fields given', async () => {
    const firestore = new FakeFirebase();
    firestore.docs.set('profiles/ada', { name: 'Ada', boardOptOut: true });

    await socialOf(firestore).saveProfile('ada', { motto: 'Hi' });

    expect(firestore.docs.get('profiles/ada')).toEqual({
      name: 'Ada',
      boardOptOut: true,
      motto: 'Hi',
      updatedAt: NOW,
    });
  });

  it('saves the public-name and opt-out flags with the profile', async () => {
    const firestore = new FakeFirebase();

    await socialOf(firestore).saveProfile('ada', {
      ...defaultProfile('ada'),
      name: 'Ada',
      publicName: true,
      boardOptOut: true,
      galleryOptOut: false,
    });

    expect(firestore.docs.get('profiles/ada')).toEqual({
      name: 'Ada',
      motto: '',
      avatar: defaultProfile('ada').avatar,
      shareStatus: true,
      publicName: true,
      boardOptOut: true,
      galleryOptOut: false,
      updatedAt: NOW,
    });
  });

  it('replaces the picture whole and keeps fields it does not know', async () => {
    const firestore = new FakeFirebase();
    firestore.docs.set('profiles/ada', {
      name: 'Ada',
      avatar: { kind: 'image', data: 'data:image/png;base64,AAAA' },
      laterFlag: true,
    });

    await socialOf(firestore).saveProfile('ada', {
      ...defaultProfile('ada'),
      avatar: { kind: 'preset', id: 2 },
    });

    const saved = firestore.docs.get('profiles/ada');
    expect(saved?.['avatar']).toEqual({ kind: 'preset', id: 2 });
    expect(saved).toMatchObject({ laterFlag: true, publicName: false });
  });
});

describe('FirestoreGameSocial queue', () => {
  let firestore: FakeFirebase;
  let social: FirestoreGameSocial;

  beforeEach(() => {
    firestore = new FakeFirebase();
    social = socialOf(firestore);
  });

  async function entry(uid: string): Promise<QueueEntry | null> {
    return firstValueFrom(social.watchQueueEntry(uid));
  }

  it('puts the level the player would like into the entry', async () => {
    await social.enqueue('ada', 'hourglass');
    expect(firestore.docs.get('queue/ada')).toMatchObject({
      level: 'hourglass',
      claim: null,
    });

    await social.enqueue('bob', null);
    expect(firestore.docs.get('queue/bob')).toMatchObject({ level: null });
    // What the rules refuse goes in as any level.
    await social.enqueue('cid', 'Not A Level!');
    expect(firestore.docs.get('queue/cid')).toMatchObject({ level: null });
  });

  it('changes the level with `seen` and `expireAt`, as the rules want it', async () => {
    await social.enqueue('ada', null);

    await social.setQueueLevel('ada', 'corridors');

    expect(firestore.writes.filter((write) => write.kind === 'update')).toEqual(
      [
        {
          kind: 'update',
          path: 'queue/ada',
          data: {
            level: 'corridors',
            seen: SERVER_TIMESTAMP,
            expireAt: expect.any(FakeTimestamp),
          },
        },
      ]
    );
  });

  it('picks from the level in the entry at the claim, and writes the pick', async () => {
    await social.enqueue('ada', 'hourglass');
    const pick = jest.fn((level: string | null) => ({
      levelId: level ?? 'petri-dish',
      pick: 'waiting' as const,
    }));

    const picked = await social.claim('ada', 'bob', 'ROOM22', pick);

    expect(pick).toHaveBeenCalledWith('hourglass');
    expect(picked).toEqual({ levelId: 'hourglass', pick: 'waiting' });
    expect(firestore.docs.get('queue/ada')?.['claim']).toEqual({
      by: 'bob',
      code: 'ROOM22',
      level: 'hourglass',
      pick: 'waiting',
    });
    expect(await entry('ada')).toMatchObject({
      level: 'hourglass',
      claim: 'ROOM22',
      picked: { levelId: 'hourglass', pick: 'waiting' },
    });
    // Taken: nobody else gets them.
    expect(await social.claim('ada', 'cid', 'ROOM33', pick)).toBeNull();
  });

  it('reads a claim from an older build, which names no level', async () => {
    firestore.docs.set('queue/ada', {
      claim: { by: 'bob', code: 'ROOM22' },
    });

    expect(await entry('ada')).toMatchObject({
      level: null,
      claim: 'ROOM22',
      picked: null,
    });
  });
});
