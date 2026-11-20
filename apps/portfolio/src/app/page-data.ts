import { Localized } from './i18n/language';

/** Title and description of a page in every language, set by SeoService. */
export interface PageData {
  title: Localized;
  description: Localized;
}
