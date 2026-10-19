/** The id of the loading screen an app may put into its index.html. */
export const SPLASH_ID = 'bacteria-game-splash';

/** How long the loading screen fades before it is taken away, in ms. */
const FADE_MS = 400;

/**
 * Fades out the loading screen the app showed while the game downloaded,
 * if it has one, and takes it away. The app's stylesheet does the fade on
 * the `done` class.
 */
export function dismissSplash(doc: Document): void {
  const splash = doc.getElementById(SPLASH_ID);
  if (splash == null) {
    return;
  }
  splash.classList.add('done');
  setTimeout(() => splash.remove(), FADE_MS);
}
