export type Poll = {
  id: string;
  question: string;
  options: string[];
  /** Votes per option, same order as `options`. */
  counts: number[];
  totalVotes: number;
  createdAt: Date;
  creatorUid: string;
};

export type NewPoll = {
  question: string;
  options: string[];
};

/** Polls take votes for 30 days; then Firestore deletes them (TTL). */
export const POLL_LIFETIME_MS: number = 1000 * 60 * 60 * 24 * 30;

export function pollClosesAt(poll: Pick<Poll, 'createdAt'>): Date {
  return new Date(poll.createdAt.getTime() + POLL_LIFETIME_MS);
}
