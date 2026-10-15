import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Poll } from '../../../shared/poll';

const STORAGE_KEY = 'rap-voted-polls';

type PollRound = Pick<Poll, 'id' | 'round'>;

/**
 * Remembers in this browser which option was picked per poll and round. Without accounts
 * this only keeps honest visitors from voting twice; it is not enforced server side.
 */
@Injectable({ providedIn: 'root' })
export class VotedPollsStore {
  private readonly isBrowser: boolean = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly votes = signal<Record<string, number>>(this.load());

  public votedOption(poll: PollRound): number | undefined {
    return this.votes()[storageKey(poll)];
  }

  public rememberVote(poll: PollRound, optionIndex: number): void {
    this.votes.update((votes) => ({
      ...votes,
      [storageKey(poll)]: optionIndex,
    }));
    this.save();
  }

  public forgetVote(poll: PollRound): void {
    this.votes.update(({ [storageKey(poll)]: _forgotten, ...votes }) => votes);
    this.save();
  }

  private load(): Record<string, number> {
    if (!this.isBrowser) {
      return {};
    }
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? '{}'
      );
      return stored !== null && typeof stored === 'object'
        ? (stored as Record<string, number>)
        : {};
    } catch {
      return {};
    }
  }

  private save(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.votes()));
    } catch {
      // storage unavailable (private mode, quota): vote stays in memory only
    }
  }
}

/** Round 0 keeps the bare poll id, as stored before polls could be edited. */
function storageKey({ id, round }: PollRound): string {
  return round === 0 ? id : `${id}#${round}`;
}
