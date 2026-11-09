import { DBB_WEBSITE_URL } from '@wolsok/feat-shared-basketball-data';

/**
 * The DBB's public site as the footer, the Impressum and the privacy
 * policy link it: its address and the name a parent knows it by.
 */
export const DBB_SEITE = {
  url: DBB_WEBSITE_URL,
  name: new URL(DBB_WEBSITE_URL).host.replace(/^www\./, ''),
} as const;
