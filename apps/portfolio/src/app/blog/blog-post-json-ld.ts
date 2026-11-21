import { SITE_OWNER } from '@wolsok/shared-legal';
import { BlogPost, blogPostPath } from './blog-post';

/**
 * The `BlogPosting` schema.org data of a post, for search engines: in
 * English, the language the pages are prerendered in.
 */
export function blogPostingJsonLd(post: BlogPost, siteUrl: string): string {
  const url = siteUrl + blogPostPath(post);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title.en,
    description: post.summary.en,
    datePublished: post.published,
    inLanguage: ['en', 'de'],
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Person', name: SITE_OWNER.name, url: siteUrl },
  });
}
