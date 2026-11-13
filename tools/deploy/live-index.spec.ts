import { describe, expect, it } from '@jest/globals';
import {
  builtIndexPath,
  checkLiveIndex,
  LiveAnswer,
  LiveCheckDeps,
} from './live-index';

const URL = 'https://korb.wolsok.de/';
const BUILT = '<!doctype html>\n<script src="main-NEW.js"></script>\n';
const STALE = '<!doctype html>\n<script src="main-OLD.js"></script>\n';

function answer(body: string, status = 200): LiveAnswer {
  return { status, body, lastModified: 'Wed, 11 Nov 2026 19:26:51 GMT' };
}

/** Deps whose fetch gives the answers in turn (an Error is thrown). */
function deps(answers: (LiveAnswer | Error)[], attempts = 3) {
  const fetched: string[] = [];
  const pauses: number[] = [];
  const lines: string[] = [];
  const given: LiveCheckDeps = {
    fetchLive: async (url) => {
      fetched.push(url);
      const next = answers.shift();
      if (!next) throw new Error('no answer left');
      if (next instanceof Error) throw next;
      return next;
    },
    pause: async (ms) => {
      pauses.push(ms);
    },
    log: (line) => lines.push(line),
    now: () => 1_700_000_000_000,
    attempts,
    pauseMs: 10_000,
  };
  return { given, fetched, pauses, lines };
}

describe('checkLiveIndex', () => {
  it('passes on the first fetch that serves the built file, without pausing', async () => {
    const { given, pauses, fetched } = deps([answer(BUILT)]);

    await expect(checkLiveIndex(URL, BUILT, given)).resolves.toEqual({
      ok: true,
      attempt: 1,
    });
    expect(pauses).toEqual([]);
    expect(fetched).toHaveLength(1);
  });

  it('busts the CDN cache with a query on the URL', async () => {
    const { given, fetched } = deps([answer(BUILT)]);

    await checkLiveIndex(URL, BUILT, given);

    expect(fetched[0]).toBe(`${URL}?deploy-check=1700000000000`);
  });

  it('waits for the release to propagate, pausing between attempts', async () => {
    const { given, pauses, lines } = deps([answer(STALE), answer(BUILT)]);

    await expect(checkLiveIndex(URL, BUILT, given)).resolves.toEqual({
      ok: true,
      attempt: 2,
    });
    expect(pauses).toEqual([10_000]);
    expect(lines[0]).toContain('attempt 1 of 3');
  });

  it('counts a fetch error and a status other than 200 as a mismatch', async () => {
    const { given } = deps([
      new Error('getaddrinfo ENOTFOUND'),
      answer('Not Found', 404),
      answer(BUILT),
    ]);

    await expect(checkLiveIndex(URL, BUILT, given)).resolves.toEqual({
      ok: true,
      attempt: 3,
    });
  });

  it('fails after the last mismatch, naming URL, last-modified, lengths and the first differing line', async () => {
    const { given, pauses } = deps([
      answer(STALE),
      answer(STALE),
      answer(STALE),
    ]);

    const result = await checkLiveIndex(URL, BUILT, given);

    expect(result.ok).toBe(false);
    expect(pauses).toEqual([10_000, 10_000]);
    const message = result.ok ? '' : result.message;
    expect(message).toContain(URL);
    expect(message).toContain('Wed, 11 Nov 2026 19:26:51 GMT');
    expect(message).toContain(`${STALE.length} bytes live`);
    expect(message).toContain(`${BUILT.length} bytes built`);
    expect(message).toContain('line 2');
    expect(message).toContain('main-OLD.js');
    expect(message).toContain('main-NEW.js');
  });

  it('names the error when the last attempt could not fetch', async () => {
    const { given } = deps([new Error('socket hang up')], 1);

    const result = await checkLiveIndex(URL, BUILT, given);

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining('socket hang up'),
    });
  });

  it('names the status when the last attempt was not 200', async () => {
    const { given } = deps([answer('oops', 503)], 1);

    const result = await checkLiveIndex(URL, BUILT, given);

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining('status 503'),
    });
  });
});

describe('builtIndexPath', () => {
  it('takes index.html from hosting.public of an object config', () => {
    expect(
      builtIndexPath({
        hosting: { public: 'dist/apps/korbjaeger/analog/public' },
      })
    ).toBe('dist/apps/korbjaeger/analog/public/index.html');
  });

  it('takes it from an array config of one entry', () => {
    expect(
      builtIndexPath({
        hosting: [{ public: 'dist/apps/pacetrainer/analog/public' }],
      })
    ).toBe('dist/apps/pacetrainer/analog/public/index.html');
  });

  it.each([
    ['no hosting', {}],
    ['an empty hosting array', { hosting: [] }],
    [
      'several hosting entries',
      { hosting: [{ public: 'a' }, { public: 'b' }] },
    ],
    ['an entry without public', { hosting: { site: 'x' } }],
  ])('refuses a config with %s', (_, config) => {
    expect(() => builtIndexPath(config)).toThrow(/hosting/);
  });
});
