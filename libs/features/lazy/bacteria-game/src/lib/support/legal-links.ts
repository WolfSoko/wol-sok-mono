/**
 * The game's own site, where its legal pages live. Absolute, as the game
 * also runs inside the shell and the Play Store app, where a relative link
 * would miss them. The site itself takes its origin from here as well, for
 * its canonical links and the sitemap.
 */
export const GAME_SITE_URL = 'https://bacteria-wars.wolsok.de';

/**
 * The routes of the legal pages on that site: the remote's `app.routes.ts`
 * serves them under these paths, the footer links to them from within.
 */
export const PRIVACY_POLICY_PATH = 'privacy';
export const LEGAL_NOTICE_PATH = 'impressum';

/** The privacy policy: the help screen links to it, the Play listing as well. */
export const PRIVACY_POLICY_URL = `${GAME_SITE_URL}/${PRIVACY_POLICY_PATH}`;
