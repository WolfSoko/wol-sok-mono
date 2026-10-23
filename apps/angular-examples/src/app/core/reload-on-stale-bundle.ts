import { NavigationError } from '@angular/router';

/** How long a reload counts as recent: a second failure in it is real. */
const RELOAD_GUARD_MS = 10_000;
const RELOAD_KEY = 'reloaded-for-stale-bundle';

/**
 * True for the error a browser throws when a lazily loaded bundle is gone,
 * as after a release of a remote: its old hashed files are replaced, while
 * this tab still knows only their names.
 */
export function isStaleBundleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(
    message
  );
}

/**
 * A navigation that failed on a bundle that is gone reloads the page at the
 * target URL once, which fetches the new release's file names. A second
 * failure soon after is a real error and stays one; so does any failure
 * while offline, or where the guard against a reload loop cannot be kept.
 */
export function reloadOnStaleBundle(
  { error, url }: NavigationError,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = sessionStorageOrNull(),
  reload: (url: string) => void = (target) => location.assign(target),
  now: number = Date.now(),
  online: boolean = typeof navigator === 'undefined' || navigator.onLine
): void {
  // Offline, the reload fails as well and only loses the page.
  if (!online || storage === null || !isStaleBundleError(error)) {
    return;
  }
  const last = Number(storage.getItem(RELOAD_KEY) ?? 0);
  if (now - last < RELOAD_GUARD_MS) {
    return;
  }
  try {
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Without the guard a reload could repeat on every page load.
    return;
  }
  reload(url);
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
