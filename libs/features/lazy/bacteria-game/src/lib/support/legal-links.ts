/**
 * The game's own site, where its legal pages live. Absolute, as the game
 * also runs inside the shell and the Play Store app, where a relative link
 * would miss them.
 */
export const GAME_SITE_URL = 'https://bacteria-wars.wolsok.de';

/** The routes of the legal pages on that site, for links from within it. */
export const PRIVACY_POLICY_PATH = '/privacy';
export const LEGAL_NOTICE_PATH = '/impressum';

/** The privacy policy: the help screen links to it, the Play listing as well. */
export const PRIVACY_POLICY_URL = `${GAME_SITE_URL}${PRIVACY_POLICY_PATH}`;

/** The legal notice (Impressum) the site owes under § 5 DDG. */
export const LEGAL_NOTICE_URL = `${GAME_SITE_URL}${LEGAL_NOTICE_PATH}`;

/**
 * Who runs the game, for the footer's copyright line. The legal pages take
 * the full details from the remote's `legal/site-owner.ts`.
 */
export const SITE_OWNER = 'Wolfram Sokollek';

/** The Play Store listing of the Android app with the given package. */
export function playStoreUrl(androidPackage: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(androidPackage)}`;
}
