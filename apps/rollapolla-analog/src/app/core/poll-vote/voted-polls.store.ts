import { Injectable, signal } from '@angular/core';
import {
  deviceStorage,
  readStoredJson,
  writeStoredJson,
} from '@wolsok/utils-browser-storage';
import { Poll } from '../../../shared/poll';

const STORAGE_KEY = 'rap-voted-polls';

type PollRound = Pick<Poll, 'id' | 'round'>;

/**
 * Remembers in this browser which option was picked per poll and round. Without accounts
 * this only keeps honest visitors from voting twice; it is not enforced server side.
 */
@Injectable({ providedIn: 'root' })
export class VotedPollsStore {
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

  /** What this browser keeps; nothing on the server or where storage is withheld. */
  private load(): Record<string, number> {
    const stored = readStoredJson(STORAGE_KEY, deviceStorage());
    return stored !== null && typeof stored === 'object'
      ? (stored as Record<string, number>)
      : {};
  }

  /** Keeps the votes; where storage is refused they stay in memory only. */
  private save(): void {
    writeStoredJson(STORAGE_KEY, this.votes(), deviceStorage());
  }
}

/** Round 0 keeps the bare poll id, as stored before polls could be edited. */
function storageKey({ id, round }: PollRound): string {
  return round === 0 ? id : `${id}#${round}`;
}
