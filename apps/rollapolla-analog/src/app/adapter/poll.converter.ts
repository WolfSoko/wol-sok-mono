import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from '@angular/fire/firestore';
import { Poll } from '../../shared/poll';
import { PollDto } from './poll.dto';

/** Votes keyed by option index ('0', '1', ...), as the rules expect. */
export function countsToDto(counts: number[]): Record<string, number> {
  return Object.fromEntries(
    counts.map((count, index) => [String(index), count])
  );
}

export const pollConverter: FirestoreDataConverter<Poll, PollDto> = {
  toFirestore(poll: Poll): PollDto {
    return {
      question: poll.question,
      options: poll.options,
      counts: countsToDto(
        poll.options.map((_, index) => poll.counts[index] ?? 0)
      ),
      totalVotes: poll.totalVotes,
      createdAt: Timestamp.fromDate(poll.createdAt),
      ttl: Timestamp.fromDate(poll.closesAt),
      creatorUid: poll.creatorUid,
      listed: poll.listed,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<PollDto>,
    options?: SnapshotOptions
  ): Poll {
    // a featured poll's createdAt is a server timestamp, pending until written
    const data = snapshot.data({
      ...options,
      serverTimestamps: 'estimate',
    }) as PollDto;
    return {
      id: snapshot.id,
      question: data.question,
      options: data.options,
      counts: data.options.map((_, index) => data.counts[String(index)] ?? 0),
      totalVotes: data.totalVotes,
      createdAt: new Date(data.createdAt.toDate()),
      closesAt: new Date(data.ttl.toDate()),
      creatorUid: data.creatorUid,
      listed: data.listed ?? false,
      round: data.round ?? 0,
    };
  },
};
