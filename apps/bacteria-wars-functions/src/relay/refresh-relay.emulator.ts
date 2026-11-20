import {
  parseRelayCredentials,
  RELAY_COLLECTION,
  RELAY_DOC_ID,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import { RELAY_TTL_S } from '../config';
import { useEmulatorDb } from '../testing/emulator';
import { timestampMillis } from '../timestamps';
import { refreshRelay } from './refresh-relay';

/**
 * `refreshRelay` against the Firestore emulator (`test-emulator`): it
 * stores what Cloudflare hands out in `relay/turn`, and leaves the
 * document as it was when Cloudflare refuses.
 */
const db = useEmulatorDb();

const key = { id: 'key-id', token: 'key-token' };
const NOW = Date.UTC(2026, 10, 20, 12);

function answering(status: number, username: string) {
  return jest.fn<Promise<Response>, Parameters<typeof fetch>>(
    async () =>
      new Response(
        JSON.stringify({
          iceServers: [
            {
              urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
              username,
              credential: 'secret',
            },
          ],
        }),
        { status }
      )
  );
}

const stored = async () =>
  (await db.collection(RELAY_COLLECTION).doc(RELAY_DOC_ID).get()).data();

describe('refreshRelay', () => {
  it('stores the credentials until they expire', async () => {
    await refreshRelay(db, key, answering(201, 'first'), NOW);
    const data = await stored();
    expect(parseRelayCredentials(data, timestampMillis)).toEqual({
      urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
      username: 'first',
      credential: 'secret',
      expireAt: NOW + RELAY_TTL_S * 1000,
    });
    expect(timestampMillis(data?.['refreshedAt'])).toBe(NOW);
  });

  it('replaces the last credentials', async () => {
    await refreshRelay(db, key, answering(201, 'first'), NOW);
    await refreshRelay(db, key, answering(201, 'second'), NOW + 1800_000);
    expect((await stored())?.['username']).toBe('second');
  });

  it('keeps the last credentials when Cloudflare refuses', async () => {
    await refreshRelay(db, key, answering(201, 'first'), NOW);
    await expect(
      refreshRelay(db, key, answering(500, 'second'), NOW + 1800_000)
    ).rejects.toThrow('(500)');
    expect((await stored())?.['username']).toBe('first');
  });
});
