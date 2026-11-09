import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DbbBasketballData,
  isBasketballDataError,
} from '@wolsok/feat-shared-basketball-data';
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { BASKETBALL_DATA } from './basketball-data.provider';
import { LokaleLetzteAntworten } from '@wolsok/feat-korbjaeger-antworten';
import type { KorbReadOptions } from './lesung';
import { proxyTransport, type ProxyFetch } from './proxy-transport';
import { teamSaisonResource } from './team-saison-resource';

const TEAM_SPIELE = '/api/dbb/team/313036/spiele';

/** The proxy answering the Team's Spiele as recorded, until told otherwise. */
function proxyMit(): {
  proxy: ProxyFetch;
  /** `undefined`: as recorded again. */
  antwortet: (proxy: ProxyFetch | undefined) => void;
} {
  const aufgezeichnet: ProxyFetch = async () =>
    new Response(
      JSON.stringify(fakeDbbAnswer('GET', 'team/id/313036/matches')),
      { status: 200 }
    );
  let aktuell = aufgezeichnet;
  return {
    proxy: (url, init) => aktuell(url, init),
    antwortet: (proxy) => {
      aktuell = proxy ?? aufgezeichnet;
    },
  };
}

const NICHT_ERREICHBAR: ProxyFetch = async () => {
  throw new TypeError('Failed to fetch');
};

/** A 200 the adapter cannot read: a Team's Spiele of the wrong shape. */
const FALSCHE_FORM: ProxyFetch = async () =>
  new Response('{"status":"0","data":{"matches":"keine Liste"}}', {
    status: 200,
  });

function lesen(proxy: ProxyFetch) {
  let jetzt = 1_000;
  const antworten = new LokaleLetzteAntworten(localStorage);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: BASKETBALL_DATA,
        useValue: new DbbBasketballData<KorbReadOptions>(
          proxyTransport(proxy, { antworten, jetzt: () => jetzt })
        ),
      },
    ],
  });
  const saison = TestBed.runInInjectionContext(() =>
    teamSaisonResource(() => 313036)
  );
  return {
    saison,
    antworten,
    spaeter: (ms: number) => {
      jetzt += ms;
    },
    stabil: () => TestBed.inject(ApplicationRef).whenStable(),
  };
}

describe('basketballDataResource', () => {
  beforeEach(() => localStorage.clear());

  it("gives a read's value its Stand while it is the last good data, and none once read afresh", async () => {
    const zustand = proxyMit();
    const { saison, spaeter, stabil } = lesen(zustand.proxy);
    await stabil();
    expect(saison.stand()).toBeUndefined();

    zustand.antwortet(NICHT_ERREICHBAR);
    spaeter(60_000);
    saison.reload();
    await stabil();
    expect(saison.hasValue()).toBe(true);
    expect(saison.stand()).toEqual({
      gespeichertAm: 1_000,
      grund: 'keine-verbindung',
    });

    zustand.antwortet(undefined);
    saison.reload();
    await stabil();
    expect(saison.hasValue()).toBe(true);
    expect(saison.stand()).toBeUndefined();
  });

  it('keeps the Stand while a reload is under way and the value it belongs to still shows', async () => {
    const zustand = proxyMit();
    const { saison, stabil } = lesen(zustand.proxy);
    await stabil();
    zustand.antwortet(NICHT_ERREICHBAR);
    saison.reload();
    await stabil();
    const stand = saison.stand();
    expect(stand).toBeDefined();

    zustand.antwortet(() => new Promise<Response>(() => undefined));
    saison.reload();
    TestBed.tick();
    await Promise.resolve();

    expect(saison.status()).toBe('reloading');
    expect(saison.stand()).toEqual(stand);
  });

  it('keeps the last good answer when a later 200 is of a shape the adapter cannot read', async () => {
    const zustand = proxyMit();
    const { saison, antworten, stabil, spaeter } = lesen(zustand.proxy);
    await stabil();

    zustand.antwortet(FALSCHE_FORM);
    spaeter(60_000);
    saison.reload();
    await stabil();

    expect(isBasketballDataError(saison.error(), 'unexpected-shape')).toBe(
      true
    );
    expect(antworten.lesen(TEAM_SPIELE, 61_000)?.gespeichertAm).toBe(1_000);
  });
});
