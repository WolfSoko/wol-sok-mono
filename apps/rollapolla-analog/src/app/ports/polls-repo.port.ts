import { Observable } from 'rxjs';
import { NewPoll, Poll } from '../../shared/poll';

export type VoteReceipt = { saved: Promise<void> };

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

  /** Emits the poll on every change, `null` if it does not exist. */
  abstract watchPoll(pollId: string): Observable<Poll | null>;

  /**
   * Emits the polls the signed-in visitor created, newest first, or `null`
   * when nobody is signed in. Never emits on the server.
   */
  abstract watchMyPolls(): Observable<Poll[] | null>;

  /**
   * Emits the option the signed-in visitor voted for, `undefined` if they have
   * not voted or are not signed in. Never signs anyone in.
   */
  abstract watchOwnVote(pollId: string): Observable<number | undefined>;

  /**
   * Signs the visitor in if needed and records their one vote on the poll.
   * Resolves once the vote is applied locally; rejects if signing in fails.
   * `saved` settles once the backend accepted the vote or rejected it, e.g.
   * because this visitor already voted from another tab.
   */
  abstract vote(poll: Poll, optionIndex: number): Promise<VoteReceipt>;
}
