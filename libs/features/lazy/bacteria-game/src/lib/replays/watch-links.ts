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
 * A page `publicSite` renders, in a language and absolute: the gallery
 * without a `publicId`, a replay's own page with one. The game links to
 * them from its own site, the Play Store app and the shell alike.
 * `publicSite` speaks German with `?lang=de`, English otherwise.
 */
export function galleryUrl(language: Language, publicId?: string): string {
  const path = publicId === undefined ? '' : `/${publicId}`;
  const query = language === 'de' ? '?lang=de' : '';
  return `${GAME_SITE_URL}/${GALLERY_PATH}${path}${query}`;
}
