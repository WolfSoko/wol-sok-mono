import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DbbBasketballData,
  isBasketballDataError,
} from '@wolsok/feat-shared-basketball-data';
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { BASKETBALL_DATA } from './basketball-data.provider';
import { LocalAnswerCache } from '@wolsok/feat-korbjaeger-answers';
import type { KorbReadOptions } from './reading';
import type { ProxyFetch } from './proxy-fetch';
import { proxyTransport } from './proxy-transport';
import { teamSeasonResource } from './team-season-resource';

const TEAM_GAMES = '/api/dbb/team/313036/spiele';

/** The proxy answering the Team's Spiele as recorded, until told otherwise. */
function proxyWith(): {
  proxy: ProxyFetch;
  /** `undefined`: as recorded again. */
  answer: (proxy: ProxyFetch | undefined) => void;
} {
  const recorded: ProxyFetch = async () =>
    new Response(
      JSON.stringify(fakeDbbAnswer('GET', 'team/id/313036/matches')),
      { status: 200 }
    );
  let current = recorded;
  return {
    proxy: (url, init) => current(url, init),
    answer: (proxy) => {
      current = proxy ?? recorded;
    },
  };
}

const UNREACHABLE: ProxyFetch = async () => {
  throw new TypeError('Failed to fetch');
};

/** A 200 the adapter cannot read: a Team's Spiele of the wrong shape. */
const WRONG_SHAPE: ProxyFetch = async () =>
  new Response('{"status":"0","data":{"matches":"keine Liste"}}', {
    status: 200,
  });

function read(proxy: ProxyFetch) {
  let now = 1_000;
  const answers = new LocalAnswerCache(localStorage);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: BASKETBALL_DATA,
        useValue: new DbbBasketballData<KorbReadOptions>(
          proxyTransport(proxy, { answers, now: () => now })
        ),
      },
    ],
  });
  const season = TestBed.runInInjectionContext(() =>
    teamSeasonResource(() => 313036)
  );
  return {
    season,
    answers,
    later: (ms: number) => {
      now += ms;
    },
    settled: () => TestBed.inject(ApplicationRef).whenStable(),
  };
}

describe('basketballDataResource', () => {
  beforeEach(() => localStorage.clear());

  it("gives a read's value its Stand while it is the last good data, and none once read afresh", async () => {
    const state = proxyWith();
    const { season, later, settled } = read(state.proxy);
    await settled();
    expect(season.asOf()).toBeUndefined();

    state.answer(UNREACHABLE);
    later(60_000);
    season.reload();
    await settled();
    expect(season.hasValue()).toBe(true);
    expect(season.asOf()).toEqual({
      storedAt: 1_000,
      reason: 'no-connection',
    });

    state.answer(undefined);
    season.reload();
    await settled();
    expect(season.hasValue()).toBe(true);
    expect(season.asOf()).toBeUndefined();
  });

  it('keeps the Stand while a reload is under way and the value it belongs to still shows', async () => {
    const state = proxyWith();
    const { season, settled } = read(state.proxy);
    await settled();
    state.answer(UNREACHABLE);
    season.reload();
    await settled();
    const asOf = season.asOf();
    expect(asOf).toBeDefined();

    state.answer(() => new Promise<Response>(() => undefined));
    season.reload();
    TestBed.tick();
    await Promise.resolve();

    expect(season.status()).toBe('reloading');
    expect(season.asOf()).toEqual(asOf);
  });

  it('keeps the last good answer when a later 200 is of a shape the adapter cannot read', async () => {
    const state = proxyWith();
    const { season, answers, settled, later } = read(state.proxy);
    await settled();

    state.answer(WRONG_SHAPE);
    later(60_000);
    season.reload();
    await settled();

    expect(isBasketballDataError(season.error(), 'unexpected-shape')).toBe(
      true
    );
    expect(answers.read(TEAM_GAMES, 61_000)?.storedAt).toBe(1_000);
  });
});
