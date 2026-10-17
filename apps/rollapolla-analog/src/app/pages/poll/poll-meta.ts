import { DestroyRef, effect, inject, Signal } from '@angular/core';
import { Poll } from '../../../shared/poll';
import {
  injectApplyPageTags,
  injectSetNotFoundStatus,
  pollUrl,
  SITE_TAGS,
} from '../site-tags';

const MAX_DESCRIPTION_LENGTH = 200;

/**
 * Gives a poll page its own title and link preview and restores the site
 * defaults when leaving. Listed polls are public (home page, search), so
 * search engines may index them; unlisted ones are only for those with the
 * link and stay out. A poll that does not exist answers 404 on the server.
 * Must run in an injection context.
 */
export function usePollMetaTags(
  poll: Signal<Poll | null | undefined>,
  pollId: Signal<string>
): void {
  const apply = injectApplyPageTags();
  const setNotFoundStatus = injectSetNotFoundStatus();

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
        : {
            ...SITE_TAGS,
            ...(current === null && { title: 'Poll not found | RollaPolla' }),
            url,
            robots: 'noindex',
          }
    );
    if (current === null) {
      setNotFoundStatus();
    }
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
