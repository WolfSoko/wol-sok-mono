import { firstValueFrom } from 'rxjs';
import { LateGameStorage } from '../../testing/late-game-storage';
import type { MatchPlan } from '../state/match-setup';
import { replayOf } from '../state/replay';
import { replayFromBytes } from '../state/replay-pack';
import {
  LOCAL_REPLAYS_KEY,
  LocalGameReplays,
  MAX_LOCAL_REPLAYS,
  parseLocalReplays,
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
      reason: 'no-cloud',
    });
    expect(parseLocalReplays(storage.stored(LOCAL_REPLAYS_KEY))).toEqual([]);
  });

  it('reads a damaged entry as nothing kept', () => {
    expect(parseLocalReplays('nonsense')).toEqual([]);
    expect(parseLocalReplays([{ id: 'x' }, null])).toEqual([]);
  });
});
