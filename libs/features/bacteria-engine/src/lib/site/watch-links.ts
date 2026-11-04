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
