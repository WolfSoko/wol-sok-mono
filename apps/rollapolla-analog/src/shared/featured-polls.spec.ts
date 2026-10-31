import rules from '../../firestore.rules?raw';
import {
  FEATURED_POLLS,
  featuredPoll,
  featuredPollClosesAt,
  featuredPollDraft,
  isFeaturedPoll,
  pollOrFeaturedDraft,
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

  it('starts as an unsaved, listed draft that runs until 1 January', () => {
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
      closesAt: new Date('2027-01-01T00:00:00Z'),
    });
    expect(featuredPoll('some-poll')).toBeUndefined();
  });

  it("tells featured polls from the visitors' polls", () => {
    expect(isFeaturedPoll({ id: 'featured-superpower' })).toBe(true);
    expect(isFeaturedPoll({ id: 'some-poll' })).toBe(false);
  });

  it('closes every season on the next 1 January (UTC)', () => {
    expect(featuredPollClosesAt(new Date('2026-12-31T23:59:59Z'))).toEqual(
      new Date('2027-01-01T00:00:00Z')
    );
    expect(featuredPollClosesAt(new Date('2027-01-01T00:00:00Z'))).toEqual(
      new Date('2028-01-01T00:00:00Z')
    );
  });

  it('falls back to the draft only for featured ids', () => {
    expect(pollOrFeaturedDraft('featured-superpower', null)?.unsaved).toBe(
      true
    );
    expect(pollOrFeaturedDraft('some-poll', null)).toBeNull();
  });
});
