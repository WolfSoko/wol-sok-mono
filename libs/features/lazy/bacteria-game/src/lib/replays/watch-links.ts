import type { Language } from '../i18n/language';
import { GAME_SITE_URL } from '../support/legal-links';

/**
 * The public gallery's paths on the game's site (ADR 0011): `publicSite`
 * renders `/replays` and `/replays/{publicId}`; the SPA plays a replay at
 * `/watch/{publicId}`, a route of the remote's `app.routes.ts`, outside the
 * route with `provideGameCloud`.
 */
export const GALLERY_PATH = 'replays';
export const WATCH_PATH = 'watch';
/** The route parameter of the watch page. */
export const WATCH_PARAM = 'publicId';

/**
 * A page `publicSite` renders, in a language: the gallery without a
 * `publicId`, a replay's own page with one. `publicSite` speaks German
 * with `?lang=de`, English otherwise. The path alone, for a link on the
 * game's own site, wherever that is served (a preview, a dev server).
 */
export function galleryPath(language: Language, publicId?: string): string {
  const path = publicId === undefined ? '' : `/${publicId}`;
  const query = language === 'de' ? '?lang=de' : '';
  return `/${GALLERY_PATH}${path}${query}`;
}

/**
 * The same page, absolute: for the shell and for canonical links, which
 * name the game's site.
 */
export function galleryUrl(language: Language, publicId?: string): string {
  return `${GAME_SITE_URL}${galleryPath(language, publicId)}`;
}
