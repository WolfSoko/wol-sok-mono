import { AppAnalytics, injectAnalytics } from '@wolsok/shared-analytics';

/** The list a poll was opened from. */
export type PollListName = 'hot' | 'browse' | 'featured' | 'mine';

/** What is shared: a poll, or RollaPolla itself (the home page). */
export type ShareSubject = 'poll' | 'site';

/**
 * What RollaPolla measures besides the page views, with what each event
 * carries (docs/analytics.md). Never a poll's id, question or options, nor
 * anything a visitor typed.
 */
export type RollaPollaEvents = {
  poll_created: { options: number; listed: boolean };
  poll_edited: { options: number; listed: boolean };
  poll_deleted: Record<string, never>;
  vote: { options: number; featured: boolean; just_created: boolean };
  /** `late`: the backend refused a vote that was already shown. */
  vote_failed: { late: boolean };
  /** `method`: `native` (share sheet), `copy` or a share target's id. */
  share: { method: string; content_type: ShareSubject };
  select_content: {
    content_type: 'poll';
    list: PollListName;
    position: number;
  };
  poll_list_sorted: { sort: string };
  login: { method: 'google' };
  /** An anonymous visitor kept their votes and polls with Google. */
  sign_up: { method: 'google' };
  chat_message_sent: { chat: 'lobby' | 'poll' };
  poll_not_found: Record<string, never>;
};

/** A poll opened from one of the lists, at its place there (from 0). */
export function pollOpened(
  list: PollListName,
  position: number
): RollaPollaEvents['select_content'] {
  return { content_type: 'poll', list, position };
}

export function injectRollaPollaAnalytics(): AppAnalytics<RollaPollaEvents> {
  return injectAnalytics<RollaPollaEvents>();
}
