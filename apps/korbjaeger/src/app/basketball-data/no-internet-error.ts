import { BasketballDataError } from '@wolsok/feat-shared-basketball-data';

/**
 * An `offline` read the browser itself calls offline (`navigator.onLine`
 * false): no internet at all, so the proxy was not called. Every other
 * `offline` read only reached no server, for whichever reason.
 */
export class NoInternetError extends BasketballDataError {
  public constructor(path: string) {
    super('offline', `${path}: the browser is offline`);
  }
}
