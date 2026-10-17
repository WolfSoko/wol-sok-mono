import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { injectResponse } from '@analogjs/router/tokens';
import { SITE_URL } from '../../shared/site-url';

export type PageTags = {
  title: string;
  description: string;
  /** og:description, the text link previews show. */
  socialDescription: string;
  url: string;
  robots: string;
};

/**
 * The site-wide tags from index.html, keep them in sync. Not read from the DOM:
 * after a server-rendered poll page the DOM already holds that poll's tags.
 */
export const SITE_TAGS: PageTags = {
  title: 'Polls for everyone | RollaPolla.com',
  description:
    'RollaPolla – easy polling for everyone: create a poll in seconds, share it and see live what others think.',
  socialDescription:
    'Easy polling for everyone: create a poll in seconds, share it and see live what others think.',
  url: `${SITE_URL}/`,
  robots: 'index, follow',
};

/**
 * Returns a function that sets title, description, canonical URL, robots and
 * the link preview tags. Call in an injection context, use the result anywhere.
 */
export function injectApplyPageTags(): (tags: PageTags) => void {
  const title = inject(Title);
  const meta = inject(Meta);
  const document = inject(DOCUMENT);
  return (tags) => {
    title.setTitle(tags.title);
    meta.updateTag({ property: 'og:title', content: tags.title });
    meta.updateTag({ name: 'description', content: tags.description });
    meta.updateTag({
      property: 'og:description',
      content: tags.socialDescription,
    });
    meta.updateTag({ property: 'og:url', content: tags.url });
    meta.updateTag({ name: 'robots', content: tags.robots });
    document.head
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute('href', tags.url);
  };
}

/**
 * Gives a page its own tags and restores the site tags when the page goes.
 * Without a `url` the page gets its own, without query or hash. Call in an
 * injection context.
 */
export function usePageTags(
  tags: Omit<PageTags, 'url'> & { url?: string }
): void {
  const apply = injectApplyPageTags();
  const url = tags.url ?? SITE_URL + inject(Router).url.split(/[?#]/)[0];
  apply({ ...tags, url });
  inject(DestroyRef).onDestroy(() => apply(SITE_TAGS));
}

/**
 * Gives a page its own title and keeps it out of search engines. Call in an
 * injection context.
 */
export function useNoindexPage(title: string): void {
  usePageTags({ ...SITE_TAGS, url: undefined, title, robots: 'noindex' });
}

/**
 * Answers the server-rendered request with 404, so search engines drop the
 * page instead of seeing a soft 404. A no-op in the browser. Call in an
 * injection context.
 */
export function injectSetNotFoundStatus(): () => void {
  const response = injectResponse();
  return () => {
    if (response && !response.headersSent) {
      response.statusCode = 404;
    }
  };
}
