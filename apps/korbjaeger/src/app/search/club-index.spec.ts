import { TestBed } from '@angular/core/testing';
import {
  isBasketballDataError,
  type IndexedClub,
} from '@wolsok/feat-shared-basketball-data';
import { KeinInternetError } from '../basketball-data/kein-internet-error';
import type { ProxyFetch } from '../basketball-data/proxy-fetch';
import { CLUB_INDEX_FETCH, ClubIndex, type ClubIndexState } from './club-index';

const WASBUETTEL: IndexedClub = {
  id: 1837,
  name: 'MTV Wasbüttel',
  associations: [{ id: 7, name: 'Niedersachsen' }],
};
const POST_SV: IndexedClub = {
  id: 1476,
  name: 'Post SV Nürnberg',
  associations: [{ id: 2, name: 'Bayern' }],
};

function answering(status: number, body: string): ProxyFetch {
  return async () =>
    new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    });
}

function setup(fetchProxy: ProxyFetch): ClubIndex {
  TestBed.configureTestingModule({
    providers: [{ provide: CLUB_INDEX_FETCH, useValue: fetchProxy }],
  });
  return TestBed.inject(ClubIndex);
}

async function settled(index: ClubIndex): Promise<ClubIndexState> {
  await vi.waitFor(() => expect(index.state().kind).not.toBe('loading'));
  return index.state();
}

describe('ClubIndex', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads nothing before the first load', () => {
    const fetchProxy = vi.fn<ProxyFetch>(answering(200, '[]'));

    const index = setup(fetchProxy);

    expect(index.state()).toEqual({ kind: 'idle' });
    expect(fetchProxy).not.toHaveBeenCalled();
  });

  it('loads /api/clubs and searches it on the device', async () => {
    const fetchProxy = vi.fn<ProxyFetch>(
      answering(200, JSON.stringify([WASBUETTEL, POST_SV]))
    );
    const index = setup(fetchProxy);

    index.load();
    expect(index.state().kind).toBe('loading');
    const state = await settled(index);

    expect(fetchProxy).toHaveBeenCalledWith('/api/clubs', expect.anything());
    expect(state.kind === 'loaded' && state.size).toBe(2);
    expect(state.kind === 'loaded' && state.search('wasbuttel')).toEqual([
      WASBUETTEL,
    ]);
  });

  it('loads once per start, however often it is asked', async () => {
    const fetchProxy = vi.fn<ProxyFetch>(answering(200, '[]'));
    const index = setup(fetchProxy);

    index.load();
    index.load();
    await settled(index);
    index.load();

    expect(fetchProxy).toHaveBeenCalledTimes(1);
  });

  it('takes an empty index as one still being built', async () => {
    const index = setup(answering(200, '[]'));

    index.load();
    const state = await settled(index);

    expect(state.kind === 'loaded' && state.size).toBe(0);
  });

  it('fails as unavailable on a 502, and loads again when asked', async () => {
    const fetchProxy = vi
      .fn<ProxyFetch>()
      .mockImplementationOnce(answering(502, '{}'))
      .mockImplementationOnce(answering(200, JSON.stringify([WASBUETTEL])));
    const index = setup(fetchProxy);

    index.load();
    const failed = await settled(index);
    expect(
      failed.kind === 'failed' &&
        isBasketballDataError(failed.error, 'unavailable')
    ).toBe(true);

    index.load();
    const loaded = await settled(index);
    expect(loaded.kind === 'loaded' && loaded.size).toBe(1);
  });

  it('fails as offline where no server answers', async () => {
    const index = setup(async () => {
      throw new TypeError('Failed to fetch');
    });

    index.load();
    const state = await settled(index);

    expect(
      state.kind === 'failed' && isBasketballDataError(state.error, 'offline')
    ).toBe(true);
  });

  it('calls nobody where the browser says it is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchProxy = vi.fn<ProxyFetch>(answering(200, '[]'));
    const index = setup(fetchProxy);

    index.load();
    const state = await settled(index);

    expect(state.kind === 'failed' && state.error).toBeInstanceOf(
      KeinInternetError
    );
    expect(fetchProxy).not.toHaveBeenCalled();
  });

  it('fails as unexpected-shape on an answer that is no list', async () => {
    const index = setup(answering(200, '{"clubs":[]}'));

    index.load();
    const state = await settled(index);

    expect(
      state.kind === 'failed' &&
        isBasketballDataError(state.error, 'unexpected-shape')
    ).toBe(true);
  });
});
