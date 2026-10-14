import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

const STORAGE_KEY = 'rap-voted-polls';

/**
 * Remembers in this browser which option was picked per poll. Without accounts
 * this only keeps honest visitors from voting twice; it is not enforced server side.
 */
@Injectable({ providedIn: 'root' })
export class VotedPollsStore {
  private readonly isBrowser: boolean = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly votes = signal<Record<string, number>>(this.load());

  public votedOption(pollId: string): number | undefined {
    return this.votes()[pollId];
  }

  public rememberVote(pollId: string, optionIndex: number): void {
    this.votes.update((votes) => ({ ...votes, [pollId]: optionIndex }));
    this.save();
  }

  private load(): Record<string, number> {
    if (!this.isBrowser) {
      return {};
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Record<string, number>) : {};
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
