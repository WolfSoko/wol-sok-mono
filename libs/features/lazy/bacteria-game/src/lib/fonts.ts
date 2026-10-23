/**
 * The faces of the menu screens: Bricolage Grotesque for display, Atkinson
 * Hyperlegible for text, Cookie for the Buy Me a Coffee button.
 */
export const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Cookie&display=swap';

/**
 * Links the game's fonts into the page, unless it has them already - an app
 * may link them in its index.html to have them for its loading screen. The
 * game loads them itself so a host app does not pay for them on every page.
 */
export function loadFonts(doc: Document): void {
  if (doc.querySelector(`link[href="${FONTS_URL}"]`) != null) {
    return;
  }
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_URL;
  doc.head.append(link);
}
