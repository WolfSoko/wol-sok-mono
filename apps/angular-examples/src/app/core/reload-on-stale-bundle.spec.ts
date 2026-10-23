import { NavigationError } from '@angular/router';
import {
  isStaleBundleError,
  reloadOnStaleBundle,
} from './reload-on-stale-bundle';

describe('reloadOnStaleBundle', () => {
  const stale = new TypeError(
    'Failed to fetch dynamically imported module: https://x/chunk-1.js'
  );

  function failed(error: unknown): NavigationError {
    return new NavigationError(1, '/bacteriaGame', error);
  }

  function memory(): Pick<Storage, 'getItem' | 'setItem'> {
    const values = new Map<string, string>();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
  }

  it('tells a missing bundle from other errors', () => {
    expect(isStaleBundleError(stale)).toBe(true);
    expect(
      isStaleBundleError(new TypeError('Importing a module script failed.'))
    ).toBe(true);
    expect(isStaleBundleError(new Error('Cannot match any routes'))).toBe(
      false
    );
  });

  it('reloads at the target once, and not again right after', () => {
    const storage = memory();
    const reload = jest.fn();

    reloadOnStaleBundle(failed(stale), storage, reload, 100_000, true);
    reloadOnStaleBundle(failed(stale), storage, reload, 105_000, true);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith('/bacteriaGame');

    reloadOnStaleBundle(failed(stale), storage, reload, 120_000, true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload offline, or without a guard it can keep', () => {
    const reload = jest.fn();
    const broken: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    reloadOnStaleBundle(failed(stale), memory(), reload, 0, false);
    reloadOnStaleBundle(failed(stale), null, reload, 0, true);
    reloadOnStaleBundle(failed(stale), broken, reload, 0, true);

    expect(reload).not.toHaveBeenCalled();
  });

  it('leaves other navigation errors alone', () => {
    const reload = jest.fn();
    reloadOnStaleBundle(failed(new Error('boom')), memory(), reload, 0, true);
    expect(reload).not.toHaveBeenCalled();
  });
});
