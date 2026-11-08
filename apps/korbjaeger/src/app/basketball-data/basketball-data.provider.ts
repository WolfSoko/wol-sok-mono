import { InjectionToken, type Provider } from '@angular/core';
import {
  DbbBasketballData,
  type BasketballData,
} from '@wolsok/feat-shared-basketball-data';
import { proxyTransport } from './proxy-transport';

/**
 * The reads the app offers: those its proxy has a route for
 * (`shared/dbb-proxy-routes.ts`), so a read without one does not compile.
 * Grows with each screen.
 */
export type KorbjaegerData = Pick<BasketballData, 'teamSpiele' | 'tabelle'>;

/** The basketball data the screens read (ADR 0018). */
export const BASKETBALL_DATA = new InjectionToken<KorbjaegerData>(
  'BasketballData'
);

/** The DBB's data, read through the app's own proxy. */
export function provideBasketballData(): Provider {
  return {
    provide: BASKETBALL_DATA,
    useFactory: (): KorbjaegerData =>
      new DbbBasketballData(proxyTransport((url, init) => fetch(url, init))),
  };
}
