import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Poll } from '../../../shared/poll';

const SITE_URL = 'https://rollapolla.com';
const MAX_DESCRIPTION_LENGTH = 200;

type PageTags = {
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
const SITE_TAGS: PageTags = {
  title: 'Polls for everyone | RollaPolla.com',
  description:
    'RollaPolla – easy polling for everyone: create a poll in seconds, share it and see live what others think.',
  socialDescription:
    'Easy polling for everyone: create a poll in seconds, share it and see live what others think.',
  url: `${SITE_URL}/`,
  robots: 'index, follow',
};

/**
 * Gives a poll page its own title and link preview, keeps it out of search
 * indexes (polls are unlisted) and restores the site defaults when leaving.
 * Must run in an injection context.
 */
export function usePollMetaTags(
  poll: Signal<Poll | null | undefined>,
  pollId: Signal<string>
): void {
  const title = inject(Title);
  const meta = inject(Meta);
  const document = inject(DOCUMENT);
  const canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );

  const apply = (tags: PageTags): void => {
    title.setTitle(tags.title);
    meta.updateTag({ property: 'og:title', content: tags.title });
    meta.updateTag({ name: 'description', content: tags.description });
    meta.updateTag({
      property: 'og:description',
      content: tags.socialDescription,
    });
    meta.updateTag({ property: 'og:url', content: tags.url });
    meta.updateTag({ name: 'robots', content: tags.robots });
    canonical?.setAttribute('href', tags.url);
  };

  effect(() => {
    const current = poll();
    const url = `${SITE_URL}/poll/${pollId()}`;
    apply(
      current
        ? {
            title: `${current.question} | RollaPolla`,
            description: pollDescription(current),
            socialDescription: pollDescription(current),
            url,
            robots: 'noindex',
          }
        : { ...SITE_TAGS, url, robots: 'noindex' }
    );
  });

  inject(DestroyRef).onDestroy(() => apply(SITE_TAGS));
}

function pollDescription(poll: Poll): string {
  return truncate(
    `Vote now: ${poll.options.join(' · ')}`,
    MAX_DESCRIPTION_LENGTH
  );
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}
