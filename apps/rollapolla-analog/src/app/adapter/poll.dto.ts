import { Timestamp } from '@angular/fire/firestore';

export interface PollDto {
  question: string;
  options: string[];
  /** Votes keyed by option index ('0', '1', ...), so a vote touches one key. */
  counts: Record<string, number>;
  totalVotes: number;
  createdAt: Timestamp;
  ttl: Timestamp;
  creatorUid: string;
}

export interface VoteDto {
  option: number;
  createdAt: Timestamp;
  /** Same as the poll's, so the vote expires with it. */
  ttl: Timestamp;
}
