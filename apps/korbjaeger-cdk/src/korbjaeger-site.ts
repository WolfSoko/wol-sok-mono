/**
 * The app's domain, as its `SITE_URL` (`apps/korbjaeger/src/shared/site.ts`)
 * names it. The stack cannot import that constant: an app is no lib, and
 * infra may depend on `infra-shared` libs only. The spec keeps both equal.
 */
export const KORBJAEGER_DOMAIN = 'korb.wolsok.de';

/**
 * The project's default Hosting site, which carries the id of the Firebase
 * project `.firebaserc` names for the app. The spec keeps both equal.
 */
export const KORBJAEGER_HOSTING_SITE = 'korbjaeger';
