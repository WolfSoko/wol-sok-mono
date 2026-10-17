import { DestroyRef, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_URL } from '../../shared/site-url';

export { pollUrl, SITE_URL } from '../../shared/site-url';

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
 * Gives a personal page its own title and keeps it out of search engines;
 * restores the site tags when the page goes. Call in an injection context.
 */
export function useNoindexPage(title: string): void {
  const titleService = inject(Title);
  const meta = inject(Meta);
  titleService.setTitle(title);
  meta.updateTag({ name: 'robots', content: 'noindex' });
  inject(DestroyRef).onDestroy(() => {
    titleService.setTitle(SITE_TAGS.title);
    meta.updateTag({ name: 'robots', content: SITE_TAGS.robots });
  });
}
