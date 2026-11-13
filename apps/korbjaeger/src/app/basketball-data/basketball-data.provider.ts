import { inject, InjectionToken, type Provider } from '@angular/core';
import {
  DbbBasketballData,
  type BasketballData,
} from '@wolsok/feat-shared-basketball-data';
import type { ProxyKind } from '../../shared/dbb-proxy-routes';
import { FREE_STORAGE } from '../device-storage';
import { ANSWER_CACHE } from './answer-cache-maintenance';
import type { KorbReadOptions } from './reading';
import { proxyTransport } from './proxy-transport';

/**
 * The reads the app offers, each by the kind of request it sends: only a
 * kind the proxy has a route for (`PROXY_ROUTES`) compiles here. Grows
 * with each screen.
 */
const READS = {
  leagueSearch: 'league-search',
  leaguePage: 'league-page',
  leagueTeams: 'schedule',
  teamGames: 'team-games',
  clubTeams: 'club-games',
  standings: 'standings',
  game: 'game-info',
  gameReport: 'game-report',
} as const satisfies Partial<Record<keyof BasketballData, ProxyKind>>;

/**
 * The reads the app offers: those its proxy has a route for, each taking
 * the app's options (`KorbReadOptions`).
 */
export type KorbjaegerData = Pick<
  BasketballData<KorbReadOptions>,
  keyof typeof READS
>;

/** The basketball data the screens read (ADR 0018). */
export const BASKETBALL_DATA = new InjectionToken<KorbjaegerData>(
  'BasketballData'
);

/**
 * The DBB's data, read through the app's own proxy, the last good answer
 * of each read without persons kept in the device's storage for when the
 * network or the DBB fails (`ANSWER_CACHE`, kept clear of answers too
 * old); those give way when Meine Teams need the room
 * (`FREE_STORAGE`).
 */
export function provideBasketballData(): Provider[] {
  return [
    {
      provide: BASKETBALL_DATA,
      useFactory: (): KorbjaegerData =>
        new DbbBasketballData<KorbReadOptions>(
          proxyTransport((url, init) => fetch(url, init), {
            answers: inject(ANSWER_CACHE),
          })
        ),
    },
    {
      provide: FREE_STORAGE,
      useFactory: (): (() => void) => {
        const answers = inject(ANSWER_CACHE);
        return () => answers.clear();
      },
    },
  ];
}
