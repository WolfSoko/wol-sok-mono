import { inject, Injectable } from '@angular/core';
import {
  collection,
  CollectionReference,
  doc,
  docData,
  Firestore,
  increment,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';
import { NewPoll, Poll } from '../../shared/poll';
import { PollsRepoPort } from '../ports/polls-repo.port';
import { pollConverter } from './poll.converter';
import { PollDto } from './poll.dto';

@Injectable()
export class PollsRepoAdapter extends PollsRepoPort {
  private readonly fs: Firestore = inject(Firestore);
  private readonly pollsCol: CollectionReference<Poll, PollDto> = collection(
    this.fs,
    'polls'
  ).withConverter<Poll, PollDto>(pollConverter);

  public createPoll(newPoll: NewPoll): string {
    if (!this.validateNewPoll(newPoll)) {
      throw new Error('Invalid poll');
    }
    const pollRef = doc(this.pollsCol);
    const options = newPoll.options.map((option) => option.trim());
    const poll: Poll = {
      id: pollRef.id,
      question: newPoll.question.trim(),
      options,
      counts: options.map(() => 0),
      totalVotes: 0,
      createdAt: new Date(),
    };
    // Not awaited: Firestore applies the write locally right away and resolves
    // only once the backend acknowledged it.
    setDoc(pollRef, poll).catch((error) =>
      console.error('Could not save poll', error)
    );
    return pollRef.id;
  }

  public watchPoll(pollId: string): Observable<Poll | null> {
    return docData(doc(this.pollsCol, pollId)).pipe(
      map((poll) => poll ?? null)
    );
  }

  public vote(pollId: string, optionIndex: number): void {
    updateDoc(doc(this.fs, 'polls', pollId), {
      [`counts.${optionIndex}`]: increment(1),
      totalVotes: increment(1),
    }).catch((error) => console.error('Could not save vote', error));
  }
}
