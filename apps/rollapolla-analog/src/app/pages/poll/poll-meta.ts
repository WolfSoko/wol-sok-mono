import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Poll } from '../../../shared/poll';
import { PageTags, pollUrl, SITE_TAGS } from '../site-tags';

const MAX_DESCRIPTION_LENGTH = 200;

/**
 * Gives a poll page its own title and link preview and restores the site
 * defaults when leaving. Listed polls are public (home page, search), so
 * search engines may index them; unlisted ones are only for those with the
 * link and stay out. Must run in an injection context.
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
    const url = pollUrl(pollId());
    apply(
      current
        ? {
            title: `${current.question} | RollaPolla`,
            description: pollDescription(current),
            socialDescription: pollDescription(current),
            url,
            robots: current.listed ? SITE_TAGS.robots : 'noindex',
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
