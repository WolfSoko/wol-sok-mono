import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from '@angular/fire/firestore';
import { Poll } from '../../shared/poll';
import { PollDto } from './poll.dto';

export const POLL_TTL_MS: number = 1000 * 60 * 60 * 24 * 30;

export const pollConverter: FirestoreDataConverter<Poll, PollDto> = {
  toFirestore(poll: Poll): PollDto {
    return {
      question: poll.question,
      options: poll.options,
      counts: Object.fromEntries(
        poll.options.map((_, index) => [String(index), poll.counts[index] ?? 0])
      ),
      totalVotes: poll.totalVotes,
      createdAt: Timestamp.fromDate(poll.createdAt),
      ttl: Timestamp.fromMillis(poll.createdAt.getTime() + POLL_TTL_MS),
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<PollDto>,
    options?: SnapshotOptions
  ): Poll {
    const data = snapshot.data(options) as PollDto;
    return {
      id: snapshot.id,
      question: data.question,
      options: data.options,
      counts: data.options.map((_, index) => data.counts[String(index)] ?? 0),
      totalVotes: data.totalVotes,
      createdAt: new Date(data.createdAt.toDate()),
    };
  },
};
