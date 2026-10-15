import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import {
  featuredPoll,
  pollOrFeaturedDraft,
  storedFeaturedPoll,
} from '../../shared/featured-polls';
import { isOpen, NewPoll, Poll, POLL_LIFETIME_MS } from '../../shared/poll';
import { PollSort, sortPolls } from '../../shared/poll-search';
import {
  OwnVote,
  PollPage,
  PollsRepoPort,
  toPollPage,
  WriteReceipt,
} from '../ports/polls-repo.port';

@Injectable()
export class PollsRepoAdapterMock extends PollsRepoPort {
  public readonly polls$ = new BehaviorSubject<Record<string, Poll>>({});
  /** The mock visitor's votes by poll id. */
  public readonly ownVotes$ = new BehaviorSubject<Record<string, OwnVote>>({});

  public polls(): Record<string, Poll> {
    return this.polls$.value;
  }

  public async createPoll(newPoll: NewPoll): Promise<string> {
    const content = this.pollContent(newPoll);
    const id = `poll-${Object.keys(this.polls()).length + 1}`;
    const createdAt = new Date();
    this.polls$.next({
      ...this.polls(),
      [id]: {
        id,
        ...content,
        createdAt,
        closesAt: new Date(createdAt.getTime() + POLL_LIFETIME_MS),
        creatorUid: 'mock-user',
        round: 0,
      },
    });
    return id;
  }

  public updatePoll(pollId: string, changes: NewPoll): WriteReceipt {
    const poll = this.polls()[pollId];
    if (!poll) {
      throw new Error('No such poll');
    }
    this.polls$.next({
      ...this.polls(),
      [pollId]: {
        ...poll,
        ...this.pollContent(changes),
        round: poll.round + 1,
      },
    });
    return { saved: Promise.resolve() };
  }

  public deletePoll(pollId: string): WriteReceipt {
    const { [pollId]: _deleted, ...polls } = this.polls();
    this.polls$.next(polls);
    return { saved: Promise.resolve() };
  }

  public watchPoll(pollId: string): Observable<Poll | null> {
    return this.polls$.pipe(
      map((polls) => pollOrFeaturedDraft(pollId, polls[pollId]))
    );
  }

  public watchHotPolls(count: number): Observable<Poll[]> {
    return this.watchPublicPolls('hot', count).pipe(map(({ polls }) => polls));
  }

  public watchPublicPolls(sort: PollSort, count: number): Observable<PollPage> {
    return this.polls$.pipe(
      map((polls) =>
        toPollPage(
          sortPolls(
            Object.values(polls).filter((poll) => poll.listed && isOpen(poll)),
            sort
          ),
          count
        )
      )
    );
  }

  /** `null` plays a visitor who is not signed in. */
  public readonly creatorUid$ = new BehaviorSubject<string | null>('mock-user');

  public watchMyPolls(
    counts: Observable<number>
  ): Observable<PollPage | null | undefined> {
    return combineLatest([this.creatorUid$, this.polls$, counts]).pipe(
      map(([uid, polls, count]) =>
        uid === null
          ? null
          : toPollPage(
              sortPolls(
                Object.values(polls).filter((poll) => poll.creatorUid === uid),
                'new'
              ),
              count
            )
      )
    );
  }

  public watchOwnVote(pollId: string): Observable<OwnVote | undefined> {
    return this.ownVotes$.pipe(map((votes) => votes[pollId]));
  }

  public async vote(
    { id, unsaved }: Poll,
    optionIndex: number
  ): Promise<WriteReceipt> {
    const featured = featuredPoll(id);
    if (unsaved && featured && !this.polls()[id]) {
      this.polls$.next({
        ...this.polls(),
        [id]: storedFeaturedPoll(featured),
      });
    }
    const poll = this.polls()[id];
    if (!poll || this.ownVotes$.value[id]?.round === poll.round) {
      return { saved: Promise.reject(new Error('Already voted')) };
    }
    this.ownVotes$.next({
      ...this.ownVotes$.value,
      [id]: { option: optionIndex, round: poll.round },
    });
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
