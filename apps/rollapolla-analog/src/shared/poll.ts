export type Poll = {
  id: string;
  question: string;
  options: string[];
  /** Votes per option, same order as `options`. */
  counts: number[];
  totalVotes: number;
  createdAt: Date;
  /** Votes are accepted until then; Firestore deletes the poll afterwards (TTL). */
  closesAt: Date;
  creatorUid: string;
  /** Shown on the home page and in search. Unlisted polls need the link. */
  listed: boolean;
  /**
   * Starts at 0; editing the poll starts the next round, which resets the
   * counts. Only votes cast in the current round count.
   */
  round: number;
  /**
   * A featured poll nobody has voted on yet: it exists only in the code, the
   * first vote or chat message stores it.
   */
  unsaved?: true;
};

export type NewPoll = {
  question: string;
  options: string[];
  /** Defaults to `false`: only people with the link find the poll. */
  listed?: boolean;
};

/** Polls take votes for 30 days; then Firestore deletes them (TTL). */
export const POLL_LIFETIME_MS: number = 1000 * 60 * 60 * 24 * 30;

export function isOpen(poll: Pick<Poll, 'closesAt'>, now: Date = new Date()) {
  return poll.closesAt.getTime() > now.getTime();
}
