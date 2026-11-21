import { I18nService } from '../i18n/i18n.service';
import { BlogPost, publishedOn } from './blog-post';

/** "Published 20 November 2026" in the language the site speaks. */
export function publishedLabel(i18n: I18nService, post: BlogPost): string {
  return i18n.fill(i18n.texts().blog.published, {
    date: publishedOn(post, i18n.locale()),
  });
}
