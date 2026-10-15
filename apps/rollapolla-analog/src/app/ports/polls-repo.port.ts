import { Observable } from 'rxjs';
import { NewPoll, Poll } from '../../shared/poll';
import { PollSort } from '../../shared/poll-search';

/** `saved` settles once the backend accepted the write or rejected it. */
export type WriteReceipt = { saved: Promise<void> };

/** A vote counts only while the poll is still in the round it was cast in. */
export type OwnVote = { option: number; round: number };

/** The first polls of a list; `hasMore` when asking for more would find some. */
export type PollPage = { polls: Poll[]; hasMore: boolean };

export abstract class PollsRepoPort {
  static readonly MIN_QUESTION_LENGTH: number = 5;
  static readonly MAX_QUESTION_LENGTH: number = 200;
  static readonly MIN_OPTIONS: number = 2;
  static readonly MAX_OPTIONS: number = 10;
  static readonly MAX_OPTION_LENGTH: number = 100;

  protected validateNewPoll(newPoll: NewPoll): boolean {
    const question = newPoll.question.trim();
    const options = newPoll.options.map((option) => option.trim());
    return (
      question.length >= PollsRepoPort.MIN_QUESTION_LENGTH &&
      question.length <= PollsRepoPort.MAX_QUESTION_LENGTH &&
      options.length >= PollsRepoPort.MIN_OPTIONS &&
      options.length <= PollsRepoPort.MAX_OPTIONS &&
      options.every(
        (option) =>
          option.length > 0 && option.length <= PollsRepoPort.MAX_OPTION_LENGTH
      )
    );
  }

  /**
   * Signs the visitor in if needed, creates the poll and returns its id. The
   * write itself syncs in the background, so the poll shows before it is acknowledged.
   */
  abstract createPoll(newPoll: NewPoll): Promise<string>;

  /**
   * Replaces the question, answers and listing of the visitor's own open poll
   * and starts its next round: all counts drop to zero and everybody may vote
   * again. Applies locally right away; throws if the changes are invalid.
   */
  abstract updatePoll(pollId: string, changes: NewPoll): WriteReceipt;

  /**
   * Deletes the visitor's own poll, locally right away. Its votes and chat
   * messages stay until the poll's TTL removes them, but nothing shows them
   * anymore. `saved` settles once the backend accepted or rejected it.
   */
  abstract deletePoll(pollId: string): WriteReceipt;

  /**
   * Emits the poll on every change, `null` if it does not exist. A featured
   * poll nobody voted on yet is emitted as its `unsaved` draft.
   */
  abstract watchPoll(pollId: string): Observable<Poll | null>;

  /** Emits the open listed polls with the most votes, at most `count`. */
  abstract watchHotPolls(count: number): Observable<Poll[]>;

  /**
   * Emits the first `count` listed polls in the given order, without the
   * closed ones the TTL has not deleted yet (so possibly fewer).
   */
  abstract watchPublicPolls(
    sort: PollSort,
    count: number
  ): Observable<PollPage>;

  /**
   * Emits the first `count` polls the signed-in visitor created, newest
   * first, or `null` when nobody is signed in. Emits `undefined` while a newly
   * signed-in account's polls load, so the previous account's list never
   * stays visible. Never emits on the server.
   */
  abstract watchMyPolls(count: number): Observable<PollPage | null | undefined>;

  /**
   * Emits the signed-in visitor's vote on the poll, in whatever round it was
   * cast, `undefined` if they have not voted or are not signed in. Never
   * signs anyone in.
   */
  abstract watchOwnVote(pollId: string): Observable<OwnVote | undefined>;

  /**
   * Signs the visitor in if needed and records their one vote on the poll;
   * an `unsaved` featured poll is stored first.
   * Resolves once the vote is applied locally; rejects if signing in fails.
   * `saved` settles once the backend accepted the vote or rejected it, e.g.
   * because this visitor already voted from another tab.
   */
  abstract vote(poll: Poll, optionIndex: number): Promise<WriteReceipt>;
}
