import type { MatchPlan } from '../state/match-setup';
import { replayOf } from '../state/replay';
import { packReplay } from '../state/replay-pack';
import { fetchPublicReplay } from './public-replays';

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
  { steers: [[0, 0, 1, 0]], drags: [], boosts: [] },
  { outcome: { endedBy: 'time', winnerSeat: 0 }, checksum: 99 }
);

function answering(status: number, body: unknown = null) {
  return jest.fn(
    async () =>
      ({
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
      }) as Response
  );
}

describe('fetchPublicReplay', () => {
  it('fetches the packed replay from the public site', async () => {
    const fetch = answering(200, packReplay(REPLAY, { forPublic: true }));

    const replay = await fetchPublicReplay('abc123XYZ', {
      base: 'https://bacteria-wars.wolsok.de',
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://bacteria-wars.wolsok.de/replays/abc123XYZ/replay.json',
      expect.anything()
    );
    expect(replay).toEqual(REPLAY);
  });

  it('is null for a replay that is not there or was taken down', async () => {
    expect(
      await fetchPublicReplay('abc123', { fetch: answering(404) })
    ).toBeNull();
    expect(
      await fetchPublicReplay('abc123', { fetch: answering(410) })
    ).toBeNull();
    expect(
      await fetchPublicReplay('abc123', { fetch: answering(200, { h: 1 }) })
    ).toBeNull();
  });

  it('fetches nothing for an id that cannot be one', async () => {
    const fetch = answering(200);

    expect(await fetchPublicReplay('../admin', { fetch })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails on a server error, for the viewer to try again', async () => {
    await expect(
      fetchPublicReplay('abc123', { fetch: answering(503) })
    ).rejects.toThrow('503');
  });
});
