import { gamesApi } from './games-api';

const API = 'https://games.googleapis.com/games/v1';

function answer(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function fakeFetch(...answers: Response[]) {
  const fetchFn = jest.fn(async () => {
    const next = answers.shift();
    if (next === undefined) {
      throw new Error('unexpected fetch');
    }
    return next;
  });
  return fetchFn as unknown as jest.Mock & typeof fetch;
}

const calls = (fetchFn: jest.Mock) =>
  fetchFn.mock.calls.map(([url, init]: [string, RequestInit]) => [
    url,
    init.method ?? 'GET',
    (init.headers as Record<string, string>)['Authorization'],
  ]);

describe('gamesApi', () => {
  it('lists the definitions in English, page by page, with the bearer token', async () => {
    const fetchFn = fakeFetch(
      answer(200, {
        items: [{ id: 'C1', name: 'First Blood' }, { id: 'bad' }],
        nextPageToken: 'next',
      }),
      answer(200, { items: [{ id: 'C2', name: 'Pacifist' }] })
    );
    expect(await gamesApi('at', fetchFn).definitions()).toEqual({
      ok: true,
      value: [
        { id: 'C1', name: 'First Blood' },
        { id: 'C2', name: 'Pacifist' },
      ],
    });
    expect(calls(fetchFn)).toEqual([
      [`${API}/achievements?language=en-US&maxResults=200`, 'GET', 'Bearer at'],
      [
        `${API}/achievements?language=en-US&maxResults=200&pageToken=next`,
        'GET',
        'Bearer at',
      ],
    ]);
  });

  it('lists the player’s states, keeping only the states it knows', async () => {
    const fetchFn = fakeFetch(
      answer(200, {
        items: [
          { id: 'C1', achievementState: 'UNLOCKED' },
          { id: 'C2', achievementState: 'REVEALED' },
          { id: 'C3', achievementState: 'HIDDEN' },
          { id: 'C4', achievementState: 'SOMETHING' },
        ],
      })
    );
    const states = await gamesApi('at', fetchFn).states();
    expect(states).toEqual({
      ok: true,
      value: new Map([
        ['C1', 'UNLOCKED'],
        ['C2', 'REVEALED'],
        ['C3', 'HIDDEN'],
      ]),
    });
    expect(calls(fetchFn)).toEqual([
      [`${API}/players/me/achievements?maxResults=200`, 'GET', 'Bearer at'],
    ]);
  });

  it('stops following pages after a bound', async () => {
    const page = () => answer(200, { items: [], nextPageToken: 'again' });
    const fetchFn = fakeFetch(page(), page(), page(), page(), page(), page());
    expect(await gamesApi('at', fetchFn).definitions()).toEqual({
      ok: true,
      value: [],
    });
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it('unlocks one achievement with an empty POST', async () => {
    const fetchFn = fakeFetch(answer(200, { newlyUnlocked: true }));
    expect(await gamesApi('at', fetchFn).unlock('C/1')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(calls(fetchFn)).toEqual([
      [`${API}/achievements/C%2F1/unlock`, 'POST', 'Bearer at'],
    ]);
  });

  it('answers a refusal with its status', async () => {
    const api = gamesApi(
      'at',
      fakeFetch(answer(404, {}), answer(500, {}), answer(401, {}))
    );
    expect(await api.unlock('C1')).toEqual({
      ok: false,
      status: 404,
      scope: false,
    });
    expect(await api.definitions()).toEqual({
      ok: false,
      status: 500,
      scope: false,
    });
    expect(await api.states()).toEqual({
      ok: false,
      status: 401,
      scope: false,
    });
  });

  it('tells a refusal for the token’s scope', async () => {
    const api = gamesApi(
      'at',
      fakeFetch(
        answer(
          403,
          {},
          { 'www-authenticate': 'Bearer error="insufficient_scope"' }
        ),
        answer(403, {
          error: { details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] },
        }),
        answer(403, {
          error: { errors: [{ reason: 'insufficientPermissions' }] },
        }),
        answer(403, { error: { errors: [{ reason: 'forbidden' }] } })
      )
    );
    expect(await api.unlock('C1')).toMatchObject({ scope: true });
    expect(await api.unlock('C1')).toMatchObject({ scope: true });
    expect(await api.unlock('C1')).toMatchObject({ scope: true });
    expect(await api.unlock('C1')).toMatchObject({ scope: false });
  });

  it('shows the token in nothing it answers', async () => {
    const api = gamesApi(
      'secret-token',
      fakeFetch(answer(403, { error: 'secret-token' }))
    );
    expect(JSON.stringify(api)).not.toContain('secret-token');
    expect(JSON.stringify(await api.unlock('C1'))).not.toContain(
      'secret-token'
    );
  });
});
