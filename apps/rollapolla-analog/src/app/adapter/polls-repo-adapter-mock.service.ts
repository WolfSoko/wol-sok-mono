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
        round: 0,
      },
    });
    return id;
  }

  public updatePoll(pollId: string, changes: NewPoll): WriteReceipt {
    const poll = this.polls()[pollId];
    if (!poll || !this.validateNewPoll(changes)) {
      throw new Error('Invalid poll');
    }
    this.polls$.next({
      ...this.polls(),
      [pollId]: {
        ...poll,
        question: changes.question.trim(),
        options: changes.options.map((option) => option.trim()),
        counts: changes.options.map(() => 0),
        totalVotes: 0,
        listed: changes.listed ?? false,
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
        page(
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

  public watchMyPolls(count: number): Observable<PollPage | null | undefined> {
    return combineLatest([this.creatorUid$, this.polls$]).pipe(
      map(([uid, polls]) =>
        uid === null
          ? null
          : page(
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

function page(polls: Poll[], count: number): PollPage {
  return { polls: polls.slice(0, count), hasMore: polls.length > count };
}
