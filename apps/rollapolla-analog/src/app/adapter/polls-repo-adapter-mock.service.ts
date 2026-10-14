import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { NewPoll, Poll } from '../../shared/poll';
import { PollsRepoPort } from '../ports/polls-repo.port';

@Injectable()
export class PollsRepoAdapterMock extends PollsRepoPort {
  private readonly polls$ = new BehaviorSubject<Record<string, Poll>>({});

  public polls(): Record<string, Poll> {
    return this.polls$.value;
  }

  public createPoll(newPoll: NewPoll): string {
    if (!this.validateNewPoll(newPoll)) {
      throw new Error('Invalid poll');
    }
    const id = `poll-${Object.keys(this.polls()).length + 1}`;
    this.polls$.next({
      ...this.polls(),
      [id]: {
        id,
        question: newPoll.question.trim(),
        options: newPoll.options.map((option) => option.trim()),
        counts: newPoll.options.map(() => 0),
        totalVotes: 0,
        createdAt: new Date(),
      },
    });
    return id;
  }

  public watchPoll(pollId: string): Observable<Poll | null> {
    return this.polls$.pipe(map((polls) => polls[pollId] ?? null));
  }

  public vote(pollId: string, optionIndex: number): void {
    const poll = this.polls()[pollId];
    if (!poll) {
      return;
    }
    this.polls$.next({
      ...this.polls(),
      [pollId]: {
        ...poll,
        counts: poll.counts.map((count, index) =>
          index === optionIndex ? count + 1 : count
        ),
        totalVotes: poll.totalVotes + 1,
      },
    });
  }
}
