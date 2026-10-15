import { isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  collection,
  CollectionReference,
  doc,
  docData,
  Firestore,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { onSnapshot } from 'firebase/firestore';
import {
  catchError,
  map,
  NEVER,
  Observable,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { NewPoll, Poll } from '../../shared/poll';
import { PollsRepoPort, VoteReceipt } from '../ports/polls-repo.port';
import { ensureSignedIn } from './ensure-signed-in';
import { pollConverter, pollTtl } from './poll.converter';
import { PollDto, VoteDto } from './poll.dto';

const MY_POLLS_LIMIT = 50;

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
    const poll: Poll = {
      id: pollRef.id,
      question: newPoll.question.trim(),
      options,
      counts: options.map(() => 0),
      totalVotes: 0,
      createdAt: new Date(),
      creatorUid,
    };
    // Not awaited: Firestore applies the write locally right away and resolves
    // only once the backend acknowledged it.
    setDoc(pollRef, poll).catch((error) =>
      console.error('Could not save poll', error)
    );
    return pollRef.id;
  }

  /**
   * Not AngularFire's `docData`: on the server that keeps rendering waiting until
   * Firestore answers, however long it takes. Callers decide how long to wait.
   */
  public watchPoll(pollId: string): Observable<Poll | null> {
    return new Observable<Poll | null>((subscriber) =>
      onSnapshot(
        doc(this.pollsCol, pollId),
        (snapshot) => subscriber.next(snapshot.data() ?? null),
        (error) => subscriber.error(error)
      )
    );
  }

  public watchMyPolls(): Observable<Poll[] | null | undefined> {
    if (this.isServer) {
      // only the browser knows who is signed in
      return NEVER;
    }
    return authState(this.auth).pipe(
      switchMap((user) =>
        user
          ? new Observable<Poll[]>((subscriber) =>
              onSnapshot(
                query(
                  this.pollsCol,
                  where('creatorUid', '==', user.uid),
                  orderBy('createdAt', 'desc'),
                  limit(MY_POLLS_LIMIT)
                ),
                (snapshot) =>
                  subscriber.next(snapshot.docs.map((poll) => poll.data())),
                (error) => subscriber.error(error)
              )
            ).pipe(startWith(undefined))
          : of(null)
      )
    );
  }

  public watchOwnVote(pollId: string): Observable<number | undefined> {
    if (this.isServer) {
      // nobody is signed in while rendering on the server
      return of(undefined);
    }
    return authState(this.auth).pipe(
      switchMap((user) =>
        user
          ? docData(doc(this.fs, 'polls', pollId, 'votes', user.uid)).pipe(
              map((vote) => (vote as VoteDto | undefined)?.option)
            )
          : of(undefined)
      ),
      // the local hint still covers the visitor when this cannot be read
      catchError(() => of(undefined))
    );
  }

  public async vote(poll: Poll, optionIndex: number): Promise<VoteReceipt> {
    const uid = await this.currentUid();
    const pollRef = doc(this.fs, 'polls', poll.id);
    const vote: VoteDto = {
      option: optionIndex,
      createdAt: Timestamp.now(),
      ttl: pollTtl(poll),
    };
    // Both writes or none: the rules only accept a count change together with
    // the creation of this user's vote document.
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

  private async currentUid(): Promise<string> {
    return (await ensureSignedIn(this.auth)).uid;
  }
}
