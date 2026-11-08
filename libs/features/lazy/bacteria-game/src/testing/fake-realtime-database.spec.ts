import { settleSnapshots } from './fake-callbacks';
import {
  FakeRealtimeDatabase,
  RTDB_PERMISSION_DENIED,
  RTDB_SERVER_TIMESTAMP,
} from './fake-realtime-database';

describe('FakeRealtimeDatabase', () => {
  let rtdb: FakeRealtimeDatabase;
  let sdk: FakeRealtimeDatabase['sdk'];

  beforeEach(() => {
    rtdb = new FakeRealtimeDatabase({ serverTime: () => 1_500 });
    sdk = rtdb.sdk;
  });

  function watch(path: string) {
    const seen: unknown[] = [];
    const errors: unknown[] = [];
    const stop = sdk.onValue(
      sdk.ref({}, path),
      (snapshot) => seen.push(snapshot.val()),
      (error) => errors.push((error as { code?: string }).code)
    );
    return { seen, errors, stop };
  }

  it('tells a listener soon, not inside the call, and again on each change', async () => {
    const { seen } = watch('bans/ada');
    expect(seen).toEqual([]);

    await settleSnapshots();
    rtdb.put('bans/ada', 0);
    await settleSnapshots();

    expect(seen).toEqual([null, 0]);
    expect(rtdb.listened).toEqual(['rtdb:bans/ada']);
  });

  it('reads a child of the value, null for one that is missing', async () => {
    rtdb.put('status/bob', { state: 'online' });
    const states: unknown[] = [];
    sdk.onValue(sdk.ref({}, 'status/bob'), (snapshot) =>
      states.push(snapshot.child('state').val(), snapshot.child('at').val())
    );
    await settleSnapshots();

    expect(states).toEqual(['online', null]);
  });

  it('tells nothing more once stopped', async () => {
    const { seen, stop } = watch('a');
    await settleSnapshots();

    stop();
    rtdb.put('a', 1);
    await settleSnapshots();

    expect(seen).toEqual([null]);
  });

  it('ends a refused listener for good, as the database does', async () => {
    rtdb.refused.add('rtdb:status/bob');
    const { seen, errors } = watch('status/bob');
    await settleSnapshots();

    rtdb.refused.delete('rtdb:status/bob');
    rtdb.put('status/bob', { state: 'online' });
    await settleSnapshots();

    expect(seen).toEqual([]);
    expect(errors).toEqual([RTDB_PERMISSION_DENIED]);
  });

  it('stores a write with the server time, logging what was sent', async () => {
    const value = { state: 'online', at: sdk.serverTimestamp() };

    await sdk.set(sdk.ref({}, 'status/ada'), value);
    await sdk.remove(sdk.ref({}, 'status/bob'));

    expect(rtdb.values.get('status/ada')).toEqual({
      state: 'online',
      at: 1_500,
    });
    expect(rtdb.writes).toEqual([
      {
        kind: 'set',
        path: 'status/ada',
        value: { state: 'online', at: RTDB_SERVER_TIMESTAMP },
      },
      { kind: 'remove', path: 'status/bob' },
    ]);
  });

  it('refuses a write to a refused path', async () => {
    rtdb.refused.add('rtdb:status/ada');

    await expect(sdk.set(sdk.ref({}, 'status/ada'), 1)).rejects.toMatchObject({
      code: RTDB_PERMISSION_DENIED,
    });
    expect(rtdb.writes).toEqual([]);
  });

  it('removes what onDisconnect armed when the connection drops', async () => {
    const ada = sdk.ref({}, 'status/ada');
    const bob = sdk.ref({}, 'status/bob');
    rtdb.put('.info/connected', true);
    rtdb.put('status/ada', 1);
    rtdb.put('status/bob', 2);
    await sdk.onDisconnect(ada).remove();
    await sdk.onDisconnect(bob).remove();
    await sdk.onDisconnect(bob).cancel();
    expect(rtdb.armedFor('status/ada')).toBe(true);

    rtdb.disconnect();

    expect(rtdb.values.has('status/ada')).toBe(false);
    expect(rtdb.values.get('status/bob')).toBe(2);
    expect(rtdb.values.get('.info/connected')).toBe(false);
    expect(rtdb.armedFor('status/ada')).toBe(false);
    expect(rtdb.writes.map((write) => write.kind)).toEqual([
      'onDisconnect.remove',
      'onDisconnect.remove',
      'onDisconnect.cancel',
    ]);
  });
});
