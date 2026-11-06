import { BehaviorSubject } from 'rxjs';
import {
  FakeFirebase,
  FakeTimestamp,
  settleSnapshots,
} from '../../testing/fake-firebase-sdk';
import { FirestoreGameModeration } from './firestore-game-moderation';
import type { PlayerBan, PlayerNotice } from './game-moderation';

const at = (ms: number) => FakeTimestamp.fromMillis(ms);

/** The moderation of whoever plays, on the fake. */
function moderationOf(
  backend: FakeFirebase,
  playerIds: BehaviorSubject<string | null>,
  rtdb = true
): FirestoreGameModeration {
  return new FirestoreGameModeration(backend.connection({ rtdb }), playerIds);
}

describe('FirestoreGameModeration', () => {
  let backend: FakeFirebase;
  let playerIds: BehaviorSubject<string | null>;

  beforeEach(() => {
    backend = new FakeFirebase();
    playerIds = new BehaviorSubject<string | null>(null);
  });

  it('listens to nothing before a player signed in', async () => {
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));
    await settleSnapshots();

    expect(backend.listened).toEqual([]);
    expect(bans).toEqual([]);
  });

  it("reads the player's ban, with why and until when", async () => {
    playerIds.next('ada');
    await settleSnapshots();
    backend.put('bans/ada', { since: at(1), until: null, reason: 'spam' });
    await settleSnapshots();
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));
    await settleSnapshots();

    expect(bans).toEqual([{ since: 1, until: null, reason: 'spam' }]);
    backend.put('bans/ada', null);
    await settleSnapshots();
    expect(bans.at(-1)).toBeNull();
  });

  it('takes the mirror for a ban while the stored one is not there yet', async () => {
    playerIds.next('ada');
    await settleSnapshots();
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));
    await settleSnapshots();

    backend.putValue('bans/ada', 0);
    await settleSnapshots();

    expect(backend.listened).toContain('rtdb:bans/ada');
    expect(bans.at(-1)).toEqual({ since: null, until: null, reason: null });
  });

  it('does without the mirror where there is no Realtime Database', async () => {
    playerIds.next('ada');
    await settleSnapshots();
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds, false)
      .ban()
      .subscribe((ban) => bans.push(ban));
    await settleSnapshots();

    expect(bans).toEqual([null]);
    expect(backend.listened).toEqual(['bans/ada']);
  });

  it('follows whoever plays', async () => {
    playerIds.next('ada');
    await settleSnapshots();
    backend.put('bans/bob', { since: at(1), until: null, reason: 'other' });
    await settleSnapshots();
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));
    await settleSnapshots();

    playerIds.next('bob');
    await settleSnapshots();

    expect(bans).toEqual([null, { since: 1, until: null, reason: 'other' }]);
  });

  it("never hands a late subscriber the last player's ban", async () => {
    playerIds.next('ada');
    await settleSnapshots();
    const moderation = moderationOf(backend, playerIds);
    const kept = moderation.ban().subscribe();
    await settleSnapshots();
    backend.pending.add('bans/bob');

    playerIds.next('bob');
    await settleSnapshots();
    const late: (PlayerBan | null)[] = [];
    moderation.ban().subscribe((ban) => late.push(ban));
    await settleSnapshots();

    // Not ada's "no ban": nothing until bob's is read.
    expect(late).toEqual([]);
    backend.put('bans/bob', { since: at(1), until: null, reason: 'spam' });
    await settleSnapshots();
    expect(late).toEqual([{ since: 1, until: null, reason: 'spam' }]);
    kept.unsubscribe();
  });

  it('lists the notices oldest first, and deletes one dismissed', async () => {
    playerIds.next('ada');
    await settleSnapshots();
    backend.put('players/ada/notices/b', { type: 'unbanned', at: at(20) });
    await settleSnapshots();
    backend.put('players/ada/notices/a', {
      type: 'banned',
      at: at(10),
      until: at(15),
      reason: 'cheating',
    });
    const moderation = moderationOf(backend, playerIds);
    const seen: PlayerNotice[][] = [];
    moderation.notices().subscribe((notices) => seen.push(notices));
    await settleSnapshots();

    expect(seen.at(-1)?.map((notice) => notice.id)).toEqual(['a', 'b']);
    await moderation.dismiss('a');

    expect(backend.deleted()).toEqual(['players/ada/notices/a']);
    expect(seen.at(-1)?.map((notice) => notice.id)).toEqual(['b']);
  });
});
