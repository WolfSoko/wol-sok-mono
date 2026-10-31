import { inject } from '@angular/core';
import { Analytics, AnalyticsParams } from './analytics';

/** An app's events: each name with the parameters it carries. */
export type EventCatalog<E> = { readonly [K in keyof E]: AnalyticsParams };

/** Events without parameters take none. */
type ParamsOf<P> = Record<string, never> extends P ? [params?: P] : [params: P];

/** `Analytics` held to an app's own event catalog. */
export interface AppAnalytics<E extends EventCatalog<E>> {
  track<K extends keyof E & string>(name: K, ...params: ParamsOf<E[K]>): void;
  screenView(screen: string): void;
  setUserProperties(properties: AnalyticsParams): void;
}

/**
 * The app's analytics, typed by its event catalog. Where analytics doesn't
 * run (the server, development, a host without it, tests) every call does
 * nothing.
 */
export function injectAnalytics<E extends EventCatalog<E>>(): AppAnalytics<E> {
  const analytics = inject(Analytics, { optional: true });
  return {
    track: (name, ...[params]) => analytics?.track(name, params),
    screenView: (screen) => analytics?.screenView(screen),
    setUserProperties: (properties) => analytics?.setUserProperties(properties),
  };
}
