import { isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  docData,
  Firestore,
  increment,
  limit,
  orderBy,
  query,
  Query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import {
  catchError,
  map,
  NEVER,
  Observable,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { pollOrFeaturedDraft } from '../../shared/featured-polls';
import { isOpen, NewPoll, Poll, POLL_LIFETIME_MS } from '../../shared/poll';
import { PollSort } from '../../shared/poll-search';
import {
  OwnVote,
  PollPage,
  PollsRepoPort,
  WriteReceipt,
} from '../ports/polls-repo.port';
import { ensureSignedIn } from './ensure-signed-in';
import { saveFeaturedPoll } from './featured-poll-doc';
import { pollConverter } from './poll.converter';
import { PollDto, VoteDto } from './poll.dto';
import { docSnapshots, queryData } from './snapshots';

/** Extra hot polls read in case some are closed but not yet deleted. */
const HOT_POLLS_SLACK = 10;

@Injectable()
export class PollsRepoAdapter extends PollsRepoPort {
  private readonly fs: Firestore = inject(Firestore);
  private readonly auth: Auth = inject(Auth);
  private readonly isServer: boolean = isPlatformServer(inject(PLATFORM_ID));
  private readonly pollsCol: CollectionReference<Poll, PollDto> = collection(
    this.fs,
    'polls'
  ).withConverter<Poll, PollDto>(pollConverter);

  public async createPoll(newPoll: NewPoll): Promise<string> {
    if (!this.validateNewPoll(newPoll)) {
      throw new Error('Invalid poll');
    }
    const creatorUid = await this.currentUid();
    const pollRef = doc(this.pollsCol);
    const options = newPoll.options.map((option) => option.trim());
    const createdAt = new Date();
    const poll: Poll = {
      id: pollRef.id,
      question: newPoll.question.trim(),
      options,
      counts: options.map(() => 0),
      totalVotes: 0,
      createdAt,
      closesAt: new Date(createdAt.getTime() + POLL_LIFETIME_MS),
      creatorUid,
      listed: newPoll.listed ?? false,
      round: 0,
    };
    // Not awaited: Firestore applies the write locally right away and resolves
    // only once the backend acknowledged it.
    setDoc(pollRef, poll).catch((error) =>
      console.error('Could not save poll', error)
    );
    return pollRef.id;
  }

  public updatePoll(pollId: string, changes: NewPoll): WriteReceipt {
    if (!this.validateNewPoll(changes)) {
      throw new Error('Invalid poll');
    }
    const options = changes.options.map((option) => option.trim());
    const update: Partial<Record<keyof PollDto, unknown>> = {
      question: changes.question.trim(),
      options,
      counts: Object.fromEntries(options.map((_, index) => [String(index), 0])),
      totalVotes: 0,
      listed: changes.listed ?? false,
      // the rules accept exactly the next round, whatever this client last saw
      round: increment(1),
    };
    return { saved: updateDoc(doc(this.fs, 'polls', pollId), update) };
  }

  public deletePoll(pollId: string): WriteReceipt {
    return { saved: deleteDoc(doc(this.fs, 'polls', pollId)) };
  }

  public watchPoll(pollId: string): Observable<Poll | null> {
    return docSnapshots(doc(this.pollsCol, pollId)).pipe(
      map((snapshot) => pollOrFeaturedDraft(pollId, snapshot.data()))
    );
  }

  public watchHotPolls(count: number): Observable<Poll[]> {
    return this.watchPublicPolls('hot', count + HOT_POLLS_SLACK).pipe(
      map(({ polls }) => polls.slice(0, count))
    );
  }

  public watchPublicPolls(sort: PollSort, count: number): Observable<PollPage> {
    const order =
      sort === 'hot'
        ? [orderBy('totalVotes', 'desc'), orderBy('createdAt', 'desc')]
        : [orderBy('createdAt', 'desc')];
    return this.watchPage(
      query(this.pollsCol, where('listed', '==', true), ...order),
      count
    ).pipe(
      map(({ polls, hasMore }) => {
        // closed polls linger until the TTL deletes them
        const now = new Date();
        return { polls: polls.filter((poll) => isOpen(poll, now)), hasMore };
      })
    );
  }

  public watchMyPolls(count: number): Observable<PollPage | null | undefined> {
    if (this.isServer) {
      // only the browser knows who is signed in
      return NEVER;
    }
    return authState(this.auth).pipe(
      switchMap((user) =>
        user
          ? this.watchPage(
              query(
                this.pollsCol,
                where('creatorUid', '==', user.uid),
                orderBy('createdAt', 'desc')
              ),
              count
            ).pipe(startWith(undefined))
          : of(null)
      )
    );
  }

  public watchOwnVote(pollId: string): Observable<OwnVote | undefined> {
    if (this.isServer) {
      // nobody is signed in while rendering on the server
      return of(undefined);
    }
    return authState(this.auth).pipe(
      switchMap((user) =>
        user
          ? docData(doc(this.fs, 'polls', pollId, 'votes', user.uid)).pipe(
              map((data) => {
                const vote = data as VoteDto | undefined;
                return vote && { option: vote.option, round: vote.round ?? 0 };
              })
            )
          : of(undefined)
      ),
      // the local hint still covers the visitor when this cannot be read
      catchError(() => of(undefined))
    );
  }

  public async vote(poll: Poll, optionIndex: number): Promise<WriteReceipt> {
    const uid = await this.currentUid();
    const stored = poll.unsaved ? saveFeaturedPoll(this.fs, poll) : poll;
    const pollRef = doc(this.fs, 'polls', poll.id);
    const vote: VoteDto = {
      option: optionIndex,
      round: poll.round,
      createdAt: Timestamp.now(),
      ttl: Timestamp.fromDate(stored.closesAt),
    };
    // Both writes or none: the rules only accept a count change together with
    // this user's vote document for the current round (created, or replacing
    // the one from an earlier round).
    const batch = writeBatch(this.fs);
    batch.set(doc(pollRef, 'votes', uid), vote);
    batch.update(pollRef, {
      [`counts.${optionIndex}`]: increment(1),
      totalVotes: increment(1),
    });
    // Not awaited: the batch applies locally right away, the backend may still
    // reject it later.
    return { saved: batch.commit() };
  }

  /** Asks for one more than `count`: whether it comes tells if there are more. */
  private watchPage(
    polls: Query<Poll, PollDto>,
    count: number
  ): Observable<PollPage> {
    return queryData(query(polls, limit(count + 1))).pipe(
      map((found) => ({
        polls: found.slice(0, count),
        hasMore: found.length > count,
      }))
    );
  }

  private async currentUid(): Promise<string> {
    return (await ensureSignedIn(this.auth)).uid;
  }
}
