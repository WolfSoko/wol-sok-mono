import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { featuredPoll, featuredPollDraft } from '../../shared/featured-polls';
import { isOpen, NewPoll, Poll, POLL_LIFETIME_MS } from '../../shared/poll';
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
    const createdAt = new Date();
    this.polls$.next({
      ...this.polls(),
      [id]: {
        id,
        question: newPoll.question.trim(),
        options: newPoll.options.map((option) => option.trim()),
        counts: newPoll.options.map(() => 0),
        totalVotes: 0,
        createdAt,
        closesAt: new Date(createdAt.getTime() + POLL_LIFETIME_MS),
        creatorUid: 'mock-user',
        listed: newPoll.listed ?? false,
      },
    });
    return id;
  }

  public watchPoll(pollId: string): Observable<Poll | null> {
    const featured = featuredPoll(pollId);
    return this.polls$.pipe(
      map(
        (polls) =>
          polls[pollId] ?? (featured ? featuredPollDraft(featured) : null)
      )
    );
  }

  public watchHotPolls(count: number): Observable<Poll[]> {
    return this.listedPolls((a, b) => b.totalVotes - a.totalVotes, count);
  }

  public watchPublicPolls(): Observable<Poll[]> {
    return this.listedPolls(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      PollsRepoPort.PUBLIC_POLLS_LIMIT
    );
  }

  private listedPolls(
    order: (a: Poll, b: Poll) => number,
    count: number
  ): Observable<Poll[]> {
    return this.polls$.pipe(
      map((polls) =>
        Object.values(polls)
          .filter((poll) => poll.listed && isOpen(poll))
          .sort(order)
          .slice(0, count)
      )
    );
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

  public async vote(
    { id, unsaved }: Poll,
    optionIndex: number
  ): Promise<VoteReceipt> {
    const featured = featuredPoll(id);
    if (unsaved && featured && !this.polls()[id]) {
      const stored: Poll = featuredPollDraft(featured);
      delete stored.unsaved;
      this.polls$.next({ ...this.polls(), [id]: stored });
    }
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
