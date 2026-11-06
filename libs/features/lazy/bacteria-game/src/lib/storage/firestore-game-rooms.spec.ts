import { BehaviorSubject } from 'rxjs';
import { FakeFirebase, FakeTimestamp } from '../../testing/fake-firebase-sdk';
import { FirestoreGameRooms, STUB_TTL_SECONDS } from './firestore-game-rooms';

/** The rooms of whoever plays, on the fake. */
function roomsOf(fake: FakeFirebase, uid: string): FirestoreGameRooms {
  return new FirestoreGameRooms(
    fake.connection(),
    new BehaviorSubject<string | null>(uid)
  );
}

/** When the fake server stored the room: with nanoseconds, as in production. */
const CREATED_AT = new FakeTimestamp(1_000, 123_456_789);

/** A room ada opened and bob answered. */
async function answered() {
  const fake = new FakeFirebase({ serverTime: CREATED_AT.toMillis() });
  const room = await roomsOf(fake, 'ada').open('offer');
  // Later than the room's creation: the stub must keep the stored time.
  fake.serverTime += 60_000;
  const joined = await roomsOf(fake, 'bob').join(room.code);
  await joined?.answer('answer');
  await expect(room.answer).resolves.toBe('answer');
  return { fake, room };
}

describe('FirestoreGameRooms', () => {
  it('swaps the answered room for its stub: who played, nothing of the descriptions', async () => {
    const { fake, room } = await answered();

    await room.take();

    // A whole new document, only what the rules' stub allows: the stored
    // creation time unchanged, the stub's life up to 6 hours from it.
    const stub = fake.docs.get(`rooms/${room.code}`);
    expect(stub).toEqual({
      host: 'ada',
      guest: 'bob',
      createdAt: CREATED_AT,
      expireAt: new FakeTimestamp(1_000 + STUB_TTL_SECONDS, 123_456_789),
      taken: true,
    });
    expect(fake.deleted()).toEqual([]);
  });

  it('takes no room without a guest', async () => {
    const fake = new FakeFirebase();
    const room = await roomsOf(fake, 'ada').open('offer');

    await expect(room.take()).rejects.toThrow();
    expect(fake.docs.get(`rooms/${room.code}`)?.['taken']).toBeUndefined();
  });

  it('still deletes a room nobody joined', async () => {
    const fake = new FakeFirebase();
    const room = await roomsOf(fake, 'ada').open('offer');

    room.close();

    expect(fake.deleted()).toEqual([`rooms/${room.code}`]);
  });
});
