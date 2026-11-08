import { firstValueFrom } from 'rxjs';
import { LateGameStorage } from '../../testing/late-game-storage';
import {
  type MatchPlan,
  replayFromBytes,
  replayOf,
} from '@wolsok/feat-shared-bacteria-engine';
import type { ReplayListing } from './replay-records';
import {
  backfilled,
  LOCAL_REPLAYS_KEY,
  LocalGameReplays,
  MAX_LOCAL_REPLAYS,
  parseLocalReplays,
  type ReadPlayback,
} from './local-game-replays';

const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'vs-computer',
  difficulty: 'normal',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 180,
  seed: 7,
};
const REPLAY = replayOf(
  PLAN,
  'cpu',
  120,
  { steers: [[0, 0, 1, 0]], drags: [], boosts: [], weapons: [] },
  { outcome: { endedBy: 'time', winnerSeat: 0 }, checksum: 99 }
);

describe('LocalGameReplays', () => {
  let storage: LateGameStorage;
  let replays: LocalGameReplays;

  beforeEach(() => {
    storage = new LateGameStorage();
    replays = new LocalGameReplays(storage);
  });

  /** Lets the storage answer, as often as `submit`'s compression needs. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      storage.flush();
    }
  }

  it('keeps a replay on the device, saved once the storage answered', async () => {
    const seen: boolean[] = [];
    const id = (await replays.submit({ replay: REPLAY, hint: 33 })) as string;
    replays.watchSaved(id).subscribe((saved) => seen.push(saved));
    expect(seen).toEqual([]);

    await settle();

    expect(seen).toContain(true);
    const list = replays.listMine();
    await settle();
    expect(await list).toEqual([
      expect.objectContaining({
        id,
        kind: 'computer',
        levelId: 'petri-dish',
        ticks: 120,
        endedBy: 'time',
        winnerSeat: 0,
        hint: 33,
        state: 'submitted',
        simulation: 'cpu',
      }),
    ]);
    const bytes = replays.replayBytes(id);
    await settle();
    const read = await bytes;
    expect(read).not.toBeNull();
    expect(await replayFromBytes(read as Uint8Array<ArrayBuffer>)).toEqual(
      REPLAY
    );
  });

  it('keeps only the newest replays', async () => {
    const now = jest.spyOn(Date, 'now');
    for (let i = 0; i <= MAX_LOCAL_REPLAYS; i++) {
      now.mockReturnValue(1000 + i);
      await replays.submit({ replay: REPLAY, hint: i });
      await settle();
    }
    now.mockRestore();

    const kept = parseLocalReplays(storage.stored(LOCAL_REPLAYS_KEY));
    expect(kept).toHaveLength(MAX_LOCAL_REPLAYS);
    expect(kept[0].hint).toBe(MAX_LOCAL_REPLAYS);
    expect(kept.some((replay) => replay.hint === 0)).toBe(false);
  });

  it('removes a replay on request, and refuses what needs the server', async () => {
    const id = (await replays.submit({ replay: REPLAY, hint: 1 })) as string;
    await settle();

    const removed = (await replays.sendCommand('remove', id)) as string;
    const featured = (await replays.sendCommand('feature', id)) as string;
    await settle();

    expect(await firstValueFrom(replays.watchCommand(removed))).toEqual({
      ok: true,
    });
    expect(await firstValueFrom(replays.watchCommand(featured))).toEqual({
      ok: false,
      error: 'no-cloud',
    });
    expect(parseLocalReplays(storage.stored(LOCAL_REPLAYS_KEY))).toEqual([]);
  });

  it('deletes a replay on "Delete" (forget) too', async () => {
    const id = (await replays.submit({ replay: REPLAY, hint: 1 })) as string;
    await settle();

    const forgotten = (await replays.sendCommand('forget', id)) as string;
    await settle();

    expect(await firstValueFrom(replays.watchCommand(forgotten))).toEqual({
      ok: true,
    });
    expect(parseLocalReplays(storage.stored(LOCAL_REPLAYS_KEY))).toEqual([]);
  });

  /** Bytes that are no base64 at all. */
  const BROKEN = '!!!';
  /** Base64 that decodes but does not inflate. */
  const UNREAD = 'AAAA';

  /** Strips `simulation` from every stored entry, and puts `bytes` into the ones named. */
  async function keepAsBeforeSimulation(
    bytes: Record<string, string>
  ): Promise<void> {
    storage.update(LOCAL_REPLAYS_KEY, (stored) =>
      (stored as Record<string, unknown>[]).map(
        ({ simulation: _simulation, ...old }) => ({
          ...old,
          bytes: bytes[old['id'] as string] ?? old['bytes'],
        })
      )
    );
    await settle();
  }

  async function listed(): Promise<ReplayListing[]> {
    const list = replays.listMine();
    await settle();
    return list;
  }

  /** Spoils every stored entry's bytes: a listing that still reads them drops the entry. */
  async function spoilBytes(): Promise<void> {
    storage.update(LOCAL_REPLAYS_KEY, (stored) =>
      (stored as Record<string, unknown>[]).map((entry) => ({
        ...entry,
        bytes: UNREAD,
      }))
    );
    await settle();
  }

  async function submitted(hint: number): Promise<string> {
    const id = (await replays.submit({ replay: REPLAY, hint })) as string;
    await settle();
    return id;
  }

  it('lists an entry kept before the store wrote its simulation, read from its bytes', async () => {
    const id = await submitted(33);
    const unread = await submitted(34);
    const broken = await submitted(35);
    await keepAsBeforeSimulation({ [unread]: UNREAD, [broken]: BROKEN });

    // The others' bytes do not read: they are left out.
    expect(await listed()).toEqual([
      expect.objectContaining({ id, simulation: 'cpu' }),
    ]);
  });

  it('writes what it read back once, removes broken bytes and keeps what did not read for next time', async () => {
    const id = await submitted(33);
    const unread = await submitted(34);
    const broken = await submitted(35);
    const asSubmitted = new Map(
      (storage.stored(LOCAL_REPLAYS_KEY) as { id: string }[]).map((entry) => [
        entry.id,
        entry,
      ])
    );
    await keepAsBeforeSimulation({ [unread]: UNREAD, [broken]: BROKEN });
    const {
      simulation: _simulation,
      ...unreadAsKept
    }: Record<string, unknown> = {
      ...(asSubmitted.get(unread) as Record<string, unknown>),
      bytes: UNREAD,
    };

    await listed();

    expect(storage.stored(LOCAL_REPLAYS_KEY)).toEqual([
      unreadAsKept,
      asSubmitted.get(id),
    ]);
    await spoilBytes();
    expect(await listed()).toEqual([
      expect.objectContaining({ id, simulation: 'cpu' }),
    ]);
  });

  it('neither reads nor writes entries that carry their simulation', async () => {
    await submitted(33);
    await spoilBytes();
    const update = jest.spyOn(storage, 'update');

    expect(await listed()).toHaveLength(1);
    expect(update).not.toHaveBeenCalled();
  });

  describe('backfilled', () => {
    const OLD = { id: 'a', bytes: 'x', levelId: 'petri-dish' };
    const PLAYBACK = {
      balanceVersion: 4,
      replayVersion: 3,
      simulation: 'gpu-int',
      ladder: 2,
    };

    it('adds what was read to the entries still lacking it, removes the broken and keeps the unread', () => {
      expect(
        backfilled(
          [OLD, { ...OLD, id: 'b' }, { ...OLD, id: 'c' }, { ...OLD, id: 'd' }],
          new Map<string, ReadPlayback>([
            ['a', PLAYBACK],
            ['b', 'broken'],
            ['c', 'unread'],
          ])
        )
      ).toEqual([
        { ...OLD, ...PLAYBACK },
        { ...OLD, id: 'c' },
        { ...OLD, id: 'd' },
      ]);
    });

    it('leaves an entry that gained its simulation meanwhile, and a deleted one, as they are', () => {
      const gained = { ...OLD, simulation: 'cpu', balanceVersion: 5 };
      const read = new Map<string, ReadPlayback>([
        ['a', PLAYBACK],
        ['gone', 'broken'],
      ]);

      expect(backfilled([gained], read)).toEqual([gained]);
      expect(backfilled(null, read)).toBeNull();
    });
  });

  it('reads a damaged entry as nothing kept', () => {
    expect(parseLocalReplays('nonsense')).toEqual([]);
    expect(parseLocalReplays([{ id: 'x' }, null])).toEqual([]);
  });
});
