import type { MatchPlan } from '../state/match-setup';
import { replayOf } from '../state/replay';
import { replayToBytes } from '../state/replay-pack';
import { loadPublicReplay } from './public-replays';

const ID = 'AbCdEfGhIjKlMnOpQrSt';
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

/** The bytes as `publicSite` sends them: base64 of the packed replay. */
async function served(): Promise<{ bytes: string }> {
  const bytes = await replayToBytes(REPLAY, { forPublic: true });
  return { bytes: Buffer.from(bytes).toString('base64') };
}

describe('loadPublicReplay', () => {
  it('fetches the packed bytes from the public site and reads them', async () => {
    const fetch = answering(200, await served());

    const answer = await loadPublicReplay(ID, {
      base: 'https://bacteria-wars.wolsok.de',
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith(
      `https://bacteria-wars.wolsok.de/replays/${ID}/replay.json`,
      expect.anything()
    );
    expect(answer).toEqual({ replay: REPLAY });
  });

  it('tells a missing, a removed and a broken replay apart', async () => {
    expect(await loadPublicReplay(ID, { fetch: answering(404) })).toEqual({
      missing: 'not-found',
    });
    expect(await loadPublicReplay(ID, { fetch: answering(410) })).toEqual({
      missing: 'removed',
    });
    for (const body of [{ bytes: 7 }, { bytes: 'AAAA' }, { h: 1 }]) {
      expect(
        await loadPublicReplay(ID, { fetch: answering(200, body) })
      ).toEqual({ missing: 'unreadable' });
    }
  });

  it('fetches nothing for an id that cannot be a public one', async () => {
    const fetch = answering(200);

    for (const id of ['../admin', 'l_AbCdEfGhIjKlMnOpQr', 'abc123']) {
      // A private replay's id is no public one either.
      expect(await loadPublicReplay(id, { fetch })).toEqual({
        missing: 'not-found',
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails on a server error, for the viewer to try again', async () => {
    await expect(
      loadPublicReplay(ID, { fetch: answering(503) })
    ).rejects.toThrow('503');
  });
});
