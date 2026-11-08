import { InjectionToken, type Provider } from '@angular/core';
import {
  DbbBasketballData,
  type BasketballData,
} from '@wolsok/feat-shared-basketball-data';
import { proxyTransport } from './proxy-transport';

/** The basketball data the screens read (ADR 0018). */
export const BASKETBALL_DATA = new InjectionToken<BasketballData>(
  'BasketballData'
);

/** The DBB's data, read through the app's own proxy. */
export function provideBasketballData(): Provider {
  return {
    provide: BASKETBALL_DATA,
    useFactory: (): BasketballData =>
      new DbbBasketballData(proxyTransport((url, init) => fetch(url, init))),
  };
}
