import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { NewPoll, Poll } from '../../shared/poll';
import { PollsRepoPort, VoteReceipt } from '../ports/polls-repo.port';

@Injectable()
export class PollsRepoAdapterMock extends PollsRepoPort {
  public readonly polls$ = new BehaviorSubject<Record<string, Poll>>({});
  /** The mock visitor's votes by poll id. */
  public readonly ownVotes$ = new BehaviorSubject<Record<string, number>>({});

  public polls(): Record<string, Poll> {
    return this.polls$.value;
  }

  public async createPoll(newPoll: NewPoll): Promise<string> {
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
        creatorUid: 'mock-user',
      },
    });
    return id;
  }

  public watchPoll(pollId: string): Observable<Poll | null> {
    return this.polls$.pipe(map((polls) => polls[pollId] ?? null));
  }

  /** `null` plays a visitor who is not signed in. */
  public readonly creatorUid$ = new BehaviorSubject<string | null>('mock-user');

  public watchMyPolls(): Observable<Poll[] | null | undefined> {
    return combineLatest([this.creatorUid$, this.polls$]).pipe(
      map(([uid, polls]) =>
        uid === null
          ? null
          : Object.values(polls)
              .filter((poll) => poll.creatorUid === uid)
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      )
    );
  }

  public watchOwnVote(pollId: string): Observable<number | undefined> {
    return this.ownVotes$.pipe(map((votes) => votes[pollId]));
  }

  public async vote({ id }: Poll, optionIndex: number): Promise<VoteReceipt> {
    const poll = this.polls()[id];
    if (!poll || this.ownVotes$.value[id] !== undefined) {
      return { saved: Promise.reject(new Error('Already voted')) };
    }
    this.ownVotes$.next({ ...this.ownVotes$.value, [id]: optionIndex });
    this.polls$.next({
      ...this.polls(),
      [id]: {
        ...poll,
        counts: poll.counts.map((count, index) =>
          index === optionIndex ? count + 1 : count
        ),
        totalVotes: poll.totalVotes + 1,
      },
    });
    return { saved: Promise.resolve() };
  }
}
