import { playGamesPlayer } from './player';

const CLIENT = { id: 'web-client', secret: 'shh' };

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
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

describe('playGamesPlayer', () => {
  it('exchanges the code and reads the player with its token', async () => {
    const fetchFn = fakeFetch(
      answer(200, { access_token: 'at', expires_in: 3599 }),
      answer(200, { playerId: 'p1', displayName: 'Ada' })
    );
    expect(await playGamesPlayer('4/0Ab', CLIENT, fetchFn)).toEqual({
      playerId: 'p1',
      displayName: 'Ada',
    });
    const [tokenUrl, tokenInit] = fetchFn.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(
      Object.fromEntries(new URLSearchParams(tokenInit.body as string))
    ).toEqual({
      code: '4/0Ab',
      client_id: 'web-client',
      client_secret: 'shh',
      grant_type: 'authorization_code',
      redirect_uri: '',
    });
    expect(fetchFn.mock.calls[1]).toEqual([
      'https://games.googleapis.com/games/v1/players/me',
      {
        headers: { Authorization: 'Bearer at' },
        signal: expect.any(AbortSignal),
      },
    ]);
  });

  it('reads a player without a name', async () => {
    const fetchFn = fakeFetch(
      answer(200, { access_token: 'at' }),
      answer(200, { playerId: 'p1' })
    );
    expect(await playGamesPlayer('c', CLIENT, fetchFn)).toEqual({
      playerId: 'p1',
      displayName: null,
    });
  });

  it('is null when Google refuses the code', async () => {
    const fetchFn = fakeFetch(answer(400, { error: 'invalid_grant' }));
    expect(await playGamesPlayer('used', CLIENT, fetchFn)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('is null without an access token or a player', async () => {
    expect(
      await playGamesPlayer('c', CLIENT, fakeFetch(answer(200, {})))
    ).toBeNull();
    expect(
      await playGamesPlayer(
        'c',
        CLIENT,
        fakeFetch(answer(200, { access_token: 'at' }), answer(403, {}))
      )
    ).toBeNull();
    expect(
      await playGamesPlayer(
        'c',
        CLIENT,
        fakeFetch(answer(200, { access_token: 'at' }), answer(200, {}))
      )
    ).toBeNull();
  });
});
