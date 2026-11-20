import { FakeFirebase, timestampAt } from '../../testing/fake-firebase-sdk';
import {
  CLOCK_SLACK_MS,
  FirestoreGameRelay,
  RELAY_KEEP_MS,
  RELAY_READ_TIMEOUT_MS,
} from './firestore-game-relay';

const NOW = 1_000_000_000;
const MINUTE = 60_000;

/** The credentials as `refreshRelay` stores them, expiring `inMs` from now. */
function stored(inMs: number, username = 'user') {
  return {
    urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
    username,
    credential: 'secret',
    expireAt: timestampAt(NOW + inMs),
    refreshedAt: timestampAt(NOW),
  };
}

describe('FirestoreGameRelay', () => {
  let backend: FakeFirebase;
  let now: number;

  const relayOf = () => new FirestoreGameRelay(backend.connection(), () => now);

  beforeEach(() => {
    backend = new FakeFirebase();
    now = NOW;
  });

  afterEach(() => jest.useRealTimers());

  it('hands out the relay of relay/turn', async () => {
    backend.put('relay/turn', stored(60 * MINUTE));
    expect(await relayOf().servers()).toEqual([
      {
        urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
        username: 'user',
        credential: 'secret',
      },
    ]);
  });

  it.each([
    ['no document', null],
    [
      'credentials expired longer ago than a clock may be off',
      stored(-CLOCK_SLACK_MS),
    ],
    ['a damaged document', { urls: 'turn:x' }],
  ])('hands out none for %s', async (_case, data) => {
    if (data !== null) {
      backend.put('relay/turn', data);
    }
    expect(await relayOf().servers()).toEqual([]);
  });

  it('hands out none when the read is refused', async () => {
    backend.put('relay/turn', stored(60 * MINUTE));
    backend.refused.add('relay/turn');
    expect(await relayOf().servers()).toEqual([]);
  });

  it(`gives a read up after ${RELAY_READ_TIMEOUT_MS} ms`, async () => {
    jest.useFakeTimers();
    backend.hangingReads = true;
    const servers = relayOf().servers();
    await jest.advanceTimersByTimeAsync(RELAY_READ_TIMEOUT_MS);
    expect(await servers).toEqual([]);
  });

  it('reads again only once the credentials it has run short', async () => {
    backend.put('relay/turn', stored(60 * MINUTE, 'first'));
    const relay = relayOf();
    expect((await relay.servers())[0]?.username).toBe('first');

    backend.put('relay/turn', stored(90 * MINUTE, 'second'));
    now = NOW + 60 * MINUTE - RELAY_KEEP_MS - 1;
    expect((await relay.servers())[0]?.username).toBe('first');

    now = NOW + 60 * MINUTE - RELAY_KEEP_MS;
    expect((await relay.servers())[0]?.username).toBe('second');
  });

  it('hands on credentials just expired by a clock that runs ahead', async () => {
    backend.put('relay/turn', stored(-CLOCK_SLACK_MS + 1));
    expect(await relayOf().servers()).toHaveLength(1);
  });

  it('keeps the credentials it has when reading newer ones fails', async () => {
    backend.put('relay/turn', stored(60 * MINUTE, 'first'));
    const relay = relayOf();
    await relay.servers();

    backend.refused.add('relay/turn');
    now = NOW + 50 * MINUTE;
    expect((await relay.servers())[0]?.username).toBe('first');
  });

  it('reads again after a read that found none', async () => {
    const relay = relayOf();
    expect(await relay.servers()).toEqual([]);
    backend.put('relay/turn', stored(60 * MINUTE));
    expect(await relay.servers()).toHaveLength(1);
  });
});
