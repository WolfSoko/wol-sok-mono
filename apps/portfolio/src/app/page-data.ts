import { Localized } from './i18n/language';

/** Title and description of a page in every language, set by SeoService. */
export interface PageData {
  title: Localized;
  description: Localized;
  /** The Open Graph type, `website` unless the page is an article. */
  type?: 'website' | 'article';
  /** Keeps the page out of search results: `noindex`, no canonical URL. */
  noindex?: true;
}
