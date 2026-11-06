import { fakeRealtime } from './fake-realtime';

describe('fakeRealtime', () => {
  it('reads and writes a tree like the real database', async () => {
    const realtime = fakeRealtime({ status: { ada: { state: 'online' } } });
    await realtime.set('bans/ada', 5);
    expect(await realtime.get('bans')).toEqual({ ada: 5 });
    expect(await realtime.get('status/ada/state')).toBe('online');
    expect(await realtime.get('status/bob')).toBeNull();
    await realtime.remove('status/ada/state');
    // A node left without children is gone.
    expect(realtime.tree).toEqual({ bans: { ada: 5 } });
  });

  it('logs what each call wrote, whichever method wrote it', async () => {
    const realtime = fakeRealtime({ status: { ada: 1 } });
    await realtime.set('bans/ada', 0);
    await realtime.remove('status/ada');
    await realtime.removeIf('bans/ada', (value) => value === 1);
    await realtime.removeIf('bans/ada', (value) => value === 0);
    await realtime.update({ 'listedBy/bob/ada/friends': true, 'x/y': null });
    expect(realtime.calls).toEqual([
      'set bans/ada 0',
      'remove status/ada',
      'remove bans/ada',
      'set listedBy/bob/ada/friends true',
      'remove x/y',
    ]);
  });

  it('refuses keys the real database refuses', async () => {
    const realtime = fakeRealtime();
    await expect(realtime.set('bans/a.b', 1)).rejects.toThrow('Invalid key');
  });

  it('fails removing the paths named in failRemoving, never setting them', async () => {
    const realtime = fakeRealtime({}, { failRemoving: ['bans/ada'] });
    await realtime.set('bans/ada', 1);
    await expect(realtime.remove('bans/ada')).rejects.toThrow('unavailable');
    await expect(realtime.removeIf('bans/ada', () => true)).rejects.toThrow(
      'unavailable'
    );
    await expect(
      realtime.update({ 'other/bob': true, 'bans/ada': null })
    ).rejects.toThrow('unavailable');
    // All or none: the update wrote nothing.
    expect(realtime.tree).toEqual({ bans: { ada: 1 } });
    expect(realtime.calls).toEqual(['set bans/ada 1']);
  });

  it('runs the hooks around reads and conditional removals', async () => {
    const order: string[] = [];
    const realtime = fakeRealtime(
      { bans: { ada: 1 } },
      {
        beforeGet: async () => order.push('beforeGet'),
        beforeRemoveIf: async () => {
          order.push('beforeRemoveIf');
          // Another writer in between: the test sees its value.
          await realtime.set('bans/ada', 2);
        },
        afterRemoveIf: async () => order.push('afterRemoveIf'),
      }
    );
    expect(await realtime.get('bans/ada')).toBe(1);
    await realtime.removeIf('bans/ada', (value) => value === 1);
    expect(order).toEqual(['beforeGet', 'beforeRemoveIf', 'afterRemoveIf']);
    expect(realtime.tree).toEqual({ bans: { ada: 2 } });
    // peek reads without the hook.
    expect(realtime.peek('bans/ada')).toBe(2);
    expect(order).toHaveLength(3);
  });
});
