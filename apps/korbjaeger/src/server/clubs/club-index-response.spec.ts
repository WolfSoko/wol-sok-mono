// @vitest-environment node
import type { AssociationClubs } from '@wolsok/feat-shared-basketball-data';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CLUB_INDEX_CACHE_SECONDS } from '../../shared/proxy-cache';
import {
  CLUB_INDEX_CACHE_CONTROL,
  clubIndexResponse,
} from './club-index-response';

const BAYERN = { id: 2, name: 'Bayern' };
const REGIONALLIGA = { id: 30, name: 'Regionalliga Südost' };

const LISTS: readonly AssociationClubs[] = [
  {
    association: REGIONALLIGA,
    clubs: [{ id: 1476, name: 'Post SV Nürnberg' }],
    updatedAt: 2,
  },
  {
    association: BAYERN,
    clubs: [
      { id: 1932, name: 'Freak City Bamberg' },
      { id: 1476, name: 'Post SV Nürnberg' },
    ],
    updatedAt: 1,
  },
];

const NO_QUERY = new URLSearchParams();

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/clubs', () => {
  it('is served from its route file where Nitro finds it', () => {
    expect(existsSync(join(__dirname, '../routes/api/clubs.get.ts'))).toBe(
      true
    );
  });

  it('answers every Club once, by name, with its Associations', async () => {
    const response = await clubIndexResponse(async () => LISTS, NO_QUERY);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      { id: 1932, name: 'Freak City Bamberg', associations: [BAYERN] },
      {
        id: 1476,
        name: 'Post SV Nürnberg',
        associations: [BAYERN, REGIONALLIGA],
      },
    ]);
    expect(response.headers['content-type']).toBe(
      'application/json; charset=utf-8'
    );
  });

  it('lets the browser keep it an hour and the CDN a day', async () => {
    const response = await clubIndexResponse(async () => LISTS, NO_QUERY);

    expect(CLUB_INDEX_CACHE_SECONDS).toEqual({ browser: 3600, cdn: 86_400 });
    expect(response.headers['cache-control']).toBe(CLUB_INDEX_CACHE_CONTROL);
    expect(CLUB_INDEX_CACHE_CONTROL).toBe(
      'public, max-age=3600, s-maxage=86400'
    );
  });

  it('answers an empty list while the index is still empty', async () => {
    const response = await clubIndexResponse(async () => [], NO_QUERY);

    expect(response.status).toBe(200);
    expect(response.body).toBe('[]');
  });

  it.each(['q=post', 'verband=2', 'x'])(
    'answers a query (%s) with 404, not stored, without reading',
    async (query) => {
      const read = vi.fn(async () => LISTS);

      const response = await clubIndexResponse(
        read,
        new URLSearchParams(query)
      );

      expect(response.status).toBe(404);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(read).not.toHaveBeenCalled();
    }
  );

  it('answers 502, not stored, when the index cannot be read', async () => {
    const response = await clubIndexResponse(
      () => Promise.reject(new Error('Firestore down')),
      NO_QUERY
    );

    expect(response.status).toBe(502);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(response.body)).toEqual({
      error: 'club-index-unavailable',
    });
  });
});
