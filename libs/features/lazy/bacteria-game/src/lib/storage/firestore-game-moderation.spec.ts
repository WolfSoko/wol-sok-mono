import { BehaviorSubject } from 'rxjs';
import { FakeFirebase, FakeTimestamp } from '../../testing/fake-firebase-sdk';
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

  it('listens to nothing before a player signed in', () => {
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));

    expect(backend.listened).toEqual([]);
    expect(bans).toEqual([]);
  });

  it("reads the player's ban, with why and until when", () => {
    playerIds.next('ada');
    backend.put('bans/ada', { since: at(1), until: null, reason: 'spam' });
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));

    expect(bans).toEqual([{ since: 1, until: null, reason: 'spam' }]);
    backend.put('bans/ada', null);
    expect(bans.at(-1)).toBeNull();
  });

  it('takes the mirror for a ban while the stored one is not there yet', () => {
    playerIds.next('ada');
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));

    backend.putValue('bans/ada', 0);

    expect(backend.listened).toContain('rtdb:bans/ada');
    expect(bans.at(-1)).toEqual({ since: null, until: null, reason: null });
  });

  it('does without the mirror where there is no Realtime Database', () => {
    playerIds.next('ada');
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds, false)
      .ban()
      .subscribe((ban) => bans.push(ban));

    expect(bans).toEqual([null]);
    expect(backend.listened).toEqual(['bans/ada']);
  });

  it('follows whoever plays', () => {
    playerIds.next('ada');
    backend.put('bans/bob', { since: at(1), until: null, reason: 'other' });
    const bans: (PlayerBan | null)[] = [];
    moderationOf(backend, playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));

    playerIds.next('bob');

    expect(bans).toEqual([null, { since: 1, until: null, reason: 'other' }]);
  });

  it("never hands a late subscriber the last player's ban", () => {
    playerIds.next('ada');
    const moderation = moderationOf(backend, playerIds);
    const kept = moderation.ban().subscribe();
    backend.pending.add('bans/bob');

    playerIds.next('bob');
    const late: (PlayerBan | null)[] = [];
    moderation.ban().subscribe((ban) => late.push(ban));

    // Not ada's "no ban": nothing until bob's is read.
    expect(late).toEqual([]);
    backend.put('bans/bob', { since: at(1), until: null, reason: 'spam' });
    expect(late).toEqual([{ since: 1, until: null, reason: 'spam' }]);
    kept.unsubscribe();
  });

  it('lists the notices oldest first, and deletes one dismissed', async () => {
    playerIds.next('ada');
    backend.put('players/ada/notices/b', { type: 'unbanned', at: at(20) });
    backend.put('players/ada/notices/a', {
      type: 'banned',
      at: at(10),
      until: at(15),
      reason: 'cheating',
    });
    const moderation = moderationOf(backend, playerIds);
    const seen: PlayerNotice[][] = [];
    moderation.notices().subscribe((notices) => seen.push(notices));

    expect(seen.at(-1)?.map((notice) => notice.id)).toEqual(['a', 'b']);
    await moderation.dismiss('a');

    expect(backend.deleted()).toEqual(['players/ada/notices/a']);
    expect(seen.at(-1)?.map((notice) => notice.id)).toEqual(['b']);
  });
});
