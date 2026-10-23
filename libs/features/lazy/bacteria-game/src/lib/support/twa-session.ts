const TWA_SESSION_KEY = 'bacteria-game.twa';

/**
 * Whether the game runs inside the Play Store app. The Trusted Web Activity
 * opens it with the referrer `android-app://<package>`; a reload inside the
 * app loses that, hence the flag in the session storage.
 */
export function isTwaSession(document: Document): boolean {
  const storage = document.defaultView?.sessionStorage;
  if (document.referrer.startsWith('android-app://')) {
    try {
      storage?.setItem(TWA_SESSION_KEY, '1');
    } catch {
      // Storage blocked: the referrer still covers this page load.
    }
    return true;
  }
  try {
    return storage?.getItem(TWA_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}
