import { Poll } from './poll';

/**
 * RollaPolla's own polls, always on the home page. Firestore only lets a poll
 * with one of these ids be created with exactly this question and these
 * options, see `featuredPolls()` in firestore.rules: keep both in sync
 * (featured-polls.spec.ts checks it). No apostrophes, the rules quote with `'`.
 */
export const FEATURED_POLLS: readonly FeaturedPoll[] = [
  {
    id: 'featured-pineapple-pizza',
    question: 'Does pineapple belong on pizza?',
    options: ['Yes, absolutely', 'No, never', 'Only with ham'],
  },
  {
    id: 'featured-superpower',
    question: 'Which superpower would you pick?',
    options: [
      'Flying',
      'Invisibility',
      'Teleportation',
      'Time travel',
      'Reading minds',
    ],
  },
  {
    id: 'featured-tabs-or-spaces',
    question: 'Tabs or spaces?',
    options: ['Tabs', 'Spaces', 'Whatever the formatter says'],
  },
  {
    id: 'featured-hot-dog-sandwich',
    question: 'Is a hot dog a sandwich?',
    options: ['Yes', 'No', 'It is a taco'],
  },
  {
    id: 'featured-morning-fuel',
    question: 'What gets you going in the morning?',
    options: [
      'Coffee',
      'Tea',
      'Mate',
      'Just water',
      'Nothing, I am a night owl',
    ],
  },
  {
    id: 'featured-ai-code',
    question: 'Will AI write most of the code by 2030?',
    options: ['Yes', 'No', 'It already does'],
  },
];

export type FeaturedPoll = {
  id: string;
  question: string;
  options: string[];
};

/** Stands in for a creator, so featured polls are nobody's "My polls". */
export const FEATURED_CREATOR_UID = 'rollapolla';

export function featuredPoll(pollId: string): FeaturedPoll | undefined {
  return FEATURED_POLLS.find(({ id }) => id === pollId);
}

/**
 * Featured polls run in yearly seasons: they close at the next 1 January
 * (UTC), and the first vote after that starts a new season. Every client
 * gets the same date, so two visitors storing a poll at once agree on it.
 */
export function featuredPollClosesAt(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
}

/** The poll as its first vote or message stores it. */
export function storedFeaturedPoll(
  { id, question, options }: FeaturedPoll,
  now: Date = new Date()
): Poll {
  return {
    id,
    question,
    options: [...options],
    counts: options.map(() => 0),
    totalVotes: 0,
    createdAt: now,
    closesAt: featuredPollClosesAt(now),
    creatorUid: FEATURED_CREATOR_UID,
    listed: true,
  };
}

/** What a featured poll nobody voted on yet shows: `unsaved` until stored. */
export function featuredPollDraft(
  featured: FeaturedPoll,
  now: Date = new Date()
): Poll {
  return { ...storedFeaturedPoll(featured, now), unsaved: true };
}

/** The stored poll, else the draft of a featured poll, else `null`. */
export function pollOrFeaturedDraft(
  pollId: string,
  stored: Poll | null | undefined
): Poll | null {
  if (stored) {
    return stored;
  }
  const featured = featuredPoll(pollId);
  return featured ? featuredPollDraft(featured) : null;
}
