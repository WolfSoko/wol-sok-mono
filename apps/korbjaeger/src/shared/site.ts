/** Where the app is served; the DBB proxy names it in its User-Agent. */
export const SITE_URL = 'https://korb.wolsok.de';

/** The host of `SITE_URL`, as the legal pages name the app. */
export const SITE_HOST = new URL(SITE_URL).host;
