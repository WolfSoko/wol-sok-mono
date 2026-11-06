import { FakeGameRooms } from './fake-game-rooms';

describe('FakeGameRooms', () => {
  it("carries the host's offer to the guest and the answer back", async () => {
    const rooms = new FakeGameRooms();
    const open = await rooms.open('offer');

    const joined = await rooms.join(open.code);
    expect(joined?.offer).toBe('offer');
    await joined?.answer('answer');

    await expect(open.answer).resolves.toBe('answer');
  });

  it('lets only the first guest answer', async () => {
    const rooms = new FakeGameRooms();
    const { code } = await rooms.open('offer');
    const first = await rooms.join(code);
    const second = await rooms.join(code);

    await first?.answer('a');

    await expect(second?.answer('b')).rejects.toEqual(
      expect.objectContaining({ code: 'permission-denied' })
    );
  });

  it('has no room for a guest once it is closed or taken', async () => {
    const rooms = new FakeGameRooms();
    const closed = await rooms.open('one');
    const taken = await rooms.open('two');

    closed.close();
    await taken.take();

    expect(await rooms.join(closed.code)).toBeNull();
    expect(await rooms.join(taken.code)).toBeNull();
    expect(await rooms.join('NOSUCH')).toBeNull();
    expect(rooms.state(closed.code)).toBe('closed');
    expect(rooms.state(taken.code)).toBe('taken');
  });

  it('tells a taken room that was closed afterwards by its close', async () => {
    const rooms = new FakeGameRooms();
    const room = await rooms.open('offer');

    await room.take();
    room.close();

    expect(rooms.state(room.code)).toBe('closed');
  });
});
