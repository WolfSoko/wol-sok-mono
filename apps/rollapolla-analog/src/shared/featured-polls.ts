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

/** Featured polls run for a year; the next vote after that starts them anew. */
export const FEATURED_POLL_LIFETIME_MS: number = 1000 * 60 * 60 * 24 * 365;

/** Stands in for a creator, so featured polls are nobody's "My polls". */
export const FEATURED_CREATOR_UID = 'rollapolla';

export function featuredPoll(pollId: string): FeaturedPoll | undefined {
  return FEATURED_POLLS.find(({ id }) => id === pollId);
}

/** The poll as stored by its first vote; `unsaved` until then. */
export function featuredPollDraft(
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
    closesAt: new Date(now.getTime() + FEATURED_POLL_LIFETIME_MS),
    creatorUid: FEATURED_CREATOR_UID,
    listed: true,
    unsaved: true,
  };
}
