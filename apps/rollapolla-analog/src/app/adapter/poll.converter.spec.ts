import { QueryDocumentSnapshot, Timestamp } from '@angular/fire/firestore';
import { Poll } from '../../shared/poll';
import { POLL_TTL_MS, pollConverter } from './poll.converter';
import { PollDto } from './poll.dto';

describe('pollConverter', () => {
  const createdAt = new Date('2026-10-14T10:00:00Z');
  const poll: Poll = {
    id: 'abc',
    question: 'Pizza or pasta?',
    options: ['Pizza', 'Pasta', 'Both'],
    counts: [3, 1, 0],
    totalVotes: 4,
    createdAt,
  };

  it('stores counts keyed by option index and a ttl', () => {
    const dto = pollConverter.toFirestore(poll) as PollDto;
    expect(dto.counts).toEqual({ '0': 3, '1': 1, '2': 0 });
    expect(dto.createdAt.toMillis()).toBe(createdAt.getTime());
    expect(dto.ttl.toMillis()).toBe(createdAt.getTime() + POLL_TTL_MS);
    expect(dto).not.toHaveProperty('id');
  });

  it('reads counts back into option order', () => {
    const dto: PollDto = {
      question: poll.question,
      options: poll.options,
      counts: { '1': 1, '0': 3 },
      totalVotes: 4,
      createdAt: Timestamp.fromDate(createdAt),
      ttl: Timestamp.fromMillis(createdAt.getTime() + POLL_TTL_MS),
    };
    const snapshot = {
      id: 'abc',
      data: () => dto,
    } as unknown as QueryDocumentSnapshot<PollDto>;

    expect(pollConverter.fromFirestore(snapshot)).toEqual(poll);
  });
});
