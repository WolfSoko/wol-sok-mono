import { isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Auth, authState, signInAnonymously } from '@angular/fire/auth';
import {
  collection,
  CollectionReference,
  doc,
  docData,
  Firestore,
  increment,
  setDoc,
  Timestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { onSnapshot } from 'firebase/firestore';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { NewPoll, Poll } from '../../shared/poll';
import { PollsRepoPort } from '../ports/polls-repo.port';
import { pollConverter, pollTtl } from './poll.converter';
import { PollDto, VoteDto } from './poll.dto';

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

  public async vote(poll: Poll, optionIndex: number): Promise<void> {
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
    batch
      .commit()
      .catch((error) => console.error('Could not save vote', error));
  }

  private async currentUid(): Promise<string> {
    await this.auth.authStateReady();
    const user =
      this.auth.currentUser ?? (await signInAnonymously(this.auth)).user;
    return user.uid;
  }
}
