import { Type } from '@angular/core';
import { Localized } from '../i18n/language';

/** An article of the blog, as the index, the routes and the JSON-LD see it. */
export interface BlogPost {
  /** The last segment of its URL, `/blog/<slug>`. */
  readonly slug: string;
  /** The day it was published, `YYYY-MM-DD`. */
  readonly published: string;
  readonly title: Localized;
  /** One or two sentences: the index's teaser and the page's description. */
  readonly summary: Localized;
  /** The article's page, loaded only when it is opened. */
  readonly loadComponent: () => Promise<Type<unknown>>;
}

/** Where a post lives on the site, without the origin. */
export function blogPostPath(post: BlogPost): string {
  return `/blog/${post.slug}`;
}

/** The day a post was published, written out in a locale (`20 November 2026`). */
export function publishedOn(post: BlogPost, locale: string): string {
  return new Date(`${post.published}T00:00:00Z`).toLocaleDateString(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  });
}
