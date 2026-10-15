import rules from '../../firestore.rules?raw';
import {
  FEATURED_POLL_LIFETIME_MS,
  FEATURED_POLLS,
  featuredPoll,
  featuredPollDraft,
} from './featured-polls';
import { PollsRepoPort } from '../app/ports/polls-repo.port';

describe('featured polls', () => {
  it('are allowed by firestore.rules exactly as defined here', () => {
    const quote = (text: string) => `'${text}'`;
    for (const { id, question, options } of FEATURED_POLLS) {
      expect(rules).toContain(
        `${quote(id)}: {'question': ${quote(question)}, 'options': [${options.map(quote).join(', ')}]}`
      );
    }
    expect(rules.match(/'featured-[\w-]+': \{/g)).toHaveLength(
      FEATURED_POLLS.length
    );
  });

  it('are valid polls with unique ids that the rules can quote', () => {
    const ids = FEATURED_POLLS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { id, question, options } of FEATURED_POLLS) {
      expect(id).toMatch(/^featured-[a-z0-9-]+$/);
      expect([question, ...options].join('')).not.toMatch(/['\\]/);
      expect(question.length).toBeGreaterThanOrEqual(
        PollsRepoPort.MIN_QUESTION_LENGTH
      );
      expect(options.length).toBeGreaterThanOrEqual(PollsRepoPort.MIN_OPTIONS);
      expect(options.length).toBeLessThanOrEqual(PollsRepoPort.MAX_OPTIONS);
    }
  });

  it('starts as an unsaved, listed draft that runs for a year', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const featured = featuredPoll('featured-tabs-or-spaces');
    if (!featured) {
      throw new Error('featured-tabs-or-spaces is missing');
    }

    const draft = featuredPollDraft(featured, now);

    expect(draft).toMatchObject({
      id: 'featured-tabs-or-spaces',
      counts: [0, 0, 0],
      totalVotes: 0,
      listed: true,
      unsaved: true,
      creatorUid: 'rollapolla',
    });
    expect(draft.closesAt.getTime() - now.getTime()).toBe(
      FEATURED_POLL_LIFETIME_MS
    );
    expect(featuredPoll('some-poll')).toBeUndefined();
  });
});
