import { InjectionToken, type Provider } from '@angular/core';
import {
  DbbBasketballData,
  type BasketballData,
} from '@wolsok/feat-shared-basketball-data';
import type { ProxyKind } from '../../shared/dbb-proxy-routes';
import { geraeteSpeicher } from '../geraete-speicher';
import { LokaleLetzteAntworten } from './letzte-antworten';
import { proxyTransport } from './proxy-transport';

/**
 * The reads the app offers, each by the kind of request it sends: only a
 * kind the proxy has a route for (`PROXY_ROUTES`) compiles here. Grows
 * with each screen.
 */
const READS = {
  ligaSuche: 'liga-suche',
  ligaSeite: 'liga-seite',
  ligaTeams: 'spielplan',
  teamSpiele: 'team-spiele',
  vereinsTeams: 'vereins-spiele',
  tabelle: 'tabelle',
  spiel: 'spiel-info',
  spielbericht: 'spielbericht',
} as const satisfies Partial<Record<keyof BasketballData, ProxyKind>>;

/** The reads the app offers: those its proxy has a route for. */
export type KorbjaegerData = Pick<BasketballData, keyof typeof READS>;

/** The basketball data the screens read (ADR 0018). */
export const BASKETBALL_DATA = new InjectionToken<KorbjaegerData>(
  'BasketballData'
);

/**
 * The DBB's data, read through the app's own proxy, each read's last good
 * answer kept in the device's storage for when the network or the DBB
 * fails (`LokaleLetzteAntworten`).
 */
export function provideBasketballData(): Provider {
  return {
    provide: BASKETBALL_DATA,
    useFactory: (): KorbjaegerData =>
      new DbbBasketballData(
        proxyTransport((url, init) => fetch(url, init), {
          antworten: new LokaleLetzteAntworten(geraeteSpeicher()),
        })
      ),
  };
}
