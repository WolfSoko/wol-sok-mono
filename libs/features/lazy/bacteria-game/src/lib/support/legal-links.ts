/**
 * The game's own site, where its legal pages live. Absolute, as the game
 * also runs inside the shell and the Play Store app, where a relative link
 * would miss them.
 */
export const GAME_SITE_URL = 'https://bacteria-wars.wolsok.de';

/** The privacy policy: the help screen and the footer link to it, the Play listing as well. */
export const PRIVACY_POLICY_URL = `${GAME_SITE_URL}/privacy`;

/** The legal notice (Impressum) the site owes under § 5 DDG. */
export const LEGAL_NOTICE_URL = `${GAME_SITE_URL}/impressum`;

/** Who runs the game, for the footer. */
export const SITE_OWNER = 'Wolfram Sokollek';

/** The Play Store listing of the Android app with the given package. */
export function playStoreUrl(androidPackage: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(androidPackage)}`;
}
