import { take } from 'rxjs';
import {
  FAKE_SERVER_TIME,
  FakeFirebase,
  settleSnapshots,
} from '../../testing/fake-firebase-sdk';
import {
  RTDB_PERMISSION_DENIED,
  RTDB_SERVER_TIMESTAMP,
} from '../../testing/fake-realtime-database';
import type { FirebaseConnection } from './firebase-connection';
import type { PresenceState } from './game-social';
import {
  REFUSED_RETRY_MS,
  REFUSED_TRIES,
  RtdbGamePresence,
} from './rtdb-game-presence';

describe('RtdbGamePresence', () => {
  let fake: FakeFirebase;

  beforeEach(() => {
    fake = new FakeFirebase();
  });

  function presence(): RtdbGamePresence {
    return new RtdbGamePresence(
      fake.connection(),
      {} as NonNullable<FirebaseConnection['rtdb']>
    );
  }

  function listensTo(path: string): number {
    return fake.listened.filter((each) => each === `rtdb:${path}`).length;
  }

  describe('watch', () => {
    beforeEach(() => jest.useFakeTimers());

    afterEach(() => jest.useRealTimers());

    it("reads a player's status", async () => {
      const seen: (PresenceState | null)[] = [];
      presence()
        .watch('bob')
        .subscribe((state) => seen.push(state));
      await settleSnapshots();

      fake.realtime.put('status/bob', { state: 'playing', at: 1 });
      await settleSnapshots();

      expect(seen).toEqual([null, 'playing']);
    });

    it('asks again while the rules refuse it, as until the friend mirror is written', async () => {
      fake.refused.add('rtdb:status/bob');
      const seen: (PresenceState | null)[] = [];
      presence()
        .watch('bob')
        .subscribe((state) => seen.push(state));
      await settleSnapshots();
      expect(seen).toEqual([null]);

      fake.refused.delete('rtdb:status/bob');
      fake.realtime.put('status/bob', { state: 'online', at: 1 });
      await jest.advanceTimersByTimeAsync(REFUSED_RETRY_MS);

      expect(seen).toEqual([null, 'online']);
      expect(listensTo('status/bob')).toBe(2);
    });

    it('gives up after a few refusals in a row', async () => {
      fake.refused.add('rtdb:status/bob');
      presence().watch('bob').subscribe();

      await jest.advanceTimersByTimeAsync(REFUSED_RETRY_MS * 100);

      expect(listensTo('status/bob')).toBe(REFUSED_TRIES + 1);
    });

    it('stops asking again once unsubscribed', async () => {
      fake.refused.add('rtdb:status/bob');
      presence().watch('bob').subscribe().unsubscribe();

      await jest.advanceTimersByTimeAsync(REFUSED_RETRY_MS * 100);

      expect(listensTo('status/bob')).toBe(1);
    });

    it('asks no more once the refusal let the subscriber go', async () => {
      fake.refused.add('rtdb:status/bob');
      // The second null comes from a retry, after the first listen.
      presence().watch('bob').pipe(take(2)).subscribe();

      await jest.advanceTimersByTimeAsync(REFUSED_RETRY_MS * 100);

      expect(listensTo('status/bob')).toBe(2);
    });
  });

  describe('set', () => {
    async function connected(): Promise<RtdbGamePresence> {
      fake.realtime.connect();
      const shared = presence();
      await settleSnapshots();
      return shared;
    }

    it('shares the status with the server time, armed to clear on a disconnect', async () => {
      const shared = await connected();

      shared.set('ada', 'online');
      await settleSnapshots();

      expect(fake.realtime.writes).toEqual([
        { kind: 'onDisconnect.remove', path: 'status/ada' },
        {
          kind: 'set',
          path: 'status/ada',
          value: { state: 'online', at: RTDB_SERVER_TIMESTAMP },
        },
      ]);
      expect(fake.realtime.values.get('status/ada')).toEqual({
        state: 'online',
        at: FAKE_SERVER_TIME,
      });

      fake.realtime.disconnect();
      expect(fake.realtime.values.has('status/ada')).toBe(false);
    });

    it('waits for the connection, and shares again when it comes back', async () => {
      const shared = presence();
      shared.set('ada', 'playing');
      await settleSnapshots();
      expect(fake.realtime.writes).toEqual([]);

      fake.realtime.connect();
      await settleSnapshots();
      fake.realtime.disconnect();
      await settleSnapshots();
      fake.realtime.connect();
      await settleSnapshots();

      expect(fake.realtime.values.get('status/ada')).toMatchObject({
        state: 'playing',
      });
      expect(
        fake.realtime.writes.filter((write) => write.kind === 'set')
      ).toHaveLength(2);
    });

    it('writes nothing for a status it shares already', async () => {
      const shared = await connected();
      shared.set('ada', 'online');
      await settleSnapshots();

      shared.set('ada', 'online');
      await settleSnapshots();

      expect(fake.realtime.writes).toHaveLength(2);
    });

    it('takes the status back for null, the disconnect disarmed', async () => {
      const shared = await connected();
      shared.set('ada', 'online');
      await settleSnapshots();

      shared.set('ada', null);
      await settleSnapshots();

      expect(fake.realtime.values.has('status/ada')).toBe(false);
      expect(fake.realtime.armed.has('status/ada')).toBe(false);
      expect(fake.realtime.writes.slice(2)).toEqual([
        { kind: 'remove', path: 'status/ada' },
        { kind: 'onDisconnect.cancel', path: 'status/ada' },
      ]);
    });

    it("takes the last player's status back when another one plays on the device", async () => {
      const shared = await connected();
      shared.set('ada', 'online');
      await settleSnapshots();

      shared.set('bob', 'online');
      await settleSnapshots();

      expect(fake.realtime.values.has('status/ada')).toBe(false);
      expect(fake.realtime.values.get('status/bob')).toMatchObject({
        state: 'online',
      });
    });

    it('warns, writes nothing, and goes on, when the rules refuse the write', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => null);
      fake.refused.add('rtdb:status/ada');
      const shared = await connected();

      shared.set('ada', 'online');
      await settleSnapshots();

      expect(warn).toHaveBeenCalledWith(
        'Could not share the online status',
        expect.objectContaining({ code: RTDB_PERMISSION_DENIED })
      );
      expect(fake.realtime.values.has('status/ada')).toBe(false);

      shared.set('bob', 'online');
      await settleSnapshots();

      expect(fake.realtime.values.get('status/bob')).toMatchObject({
        state: 'online',
      });
      warn.mockRestore();
    });

    it('warns when the status cannot be taken back', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => null);
      const shared = await connected();
      shared.set('ada', 'online');
      await settleSnapshots();
      fake.refused.add('rtdb:status/ada');

      shared.set('ada', null);
      await settleSnapshots();

      expect(warn).toHaveBeenCalledWith(
        'Could not take the online status back',
        expect.objectContaining({ code: RTDB_PERMISSION_DENIED })
      );
      // The disconnect still clears it.
      expect(fake.realtime.armed.has('status/ada')).toBe(true);
      warn.mockRestore();
    });
  });
});
