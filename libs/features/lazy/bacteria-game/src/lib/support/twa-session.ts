const TWA_SESSION_KEY = 'bacteria-game.twa';

/**
 * The `source` the Play Store app's launch URL carries (`build.gradle.kts`):
 * the WebView fallback sends no referrer, and other apps' referrers say
 * nothing about this one.
 */
const APP_LAUNCH_SOURCE = 'twa';

/**
 * Whether the game runs inside the Play Store app with the given package:
 * launched with `?source=twa`, or opened from a link by Chrome, which
 * then sends the referrer `android-app://<package>`. A reload inside the app
 * loses both, hence the flag in the session storage.
 */
export function isTwaSession(document: Document, appPackage: string): boolean {
  const storage = document.defaultView?.sessionStorage;
  const source = new URLSearchParams(document.location.search).get('source');
  const referrer = document.referrer.replace(/\/$/, '');
  if (
    source === APP_LAUNCH_SOURCE ||
    referrer === `android-app://${appPackage}`
  ) {
    try {
      storage?.setItem(TWA_SESSION_KEY, '1');
    } catch {
      // Storage blocked: the referrer or the query still covers this page load.
    }
    return true;
  }
  try {
    return storage?.getItem(TWA_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}
