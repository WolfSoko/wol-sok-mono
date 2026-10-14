import { Observable } from 'rxjs';
import { NewPoll, Poll } from '../../shared/poll';

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
   * Creates the poll and returns its id right away. The write is synced to the
   * backend in the background, so the poll can be shown before it is acknowledged.
   */
  abstract createPoll(newPoll: NewPoll): string;

  /** Emits the poll on every change, `null` if it does not exist. */
  abstract watchPoll(pollId: string): Observable<Poll | null>;

  abstract vote(pollId: string, optionIndex: number): void;
}
