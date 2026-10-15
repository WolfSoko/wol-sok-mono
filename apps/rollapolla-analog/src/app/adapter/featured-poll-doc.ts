import {
  doc,
  Firestore,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { featuredPoll, storedFeaturedPoll } from '../../shared/featured-polls';
import { Poll } from '../../shared/poll';
import { pollConverter } from './poll.converter';

/**
 * Stores a featured poll nobody has voted on or chatted about yet, and returns
 * it as stored. Not awaited by callers: writes from one client reach the
 * backend in order, so a vote or message written next finds the poll.
 *
 * `createdAt` is the server's time, so a wrong client clock cannot date the
 * poll; the rules insist on it. `closesAt` is the next 1 January for every
 * client, so when two visitors store the poll at once, the second write is
 * refused but its vote or message still carries the right ttl.
 */
export function saveFeaturedPoll(fs: Firestore, unsaved: Poll): Poll {
  const featured = featuredPoll(unsaved.id);
  if (!featured) {
    throw new Error(`Not a featured poll: ${unsaved.id}`);
  }
  const poll = storedFeaturedPoll(featured);
  setDoc(doc(fs, 'polls', poll.id), {
    ...pollConverter.toFirestore(poll),
    createdAt: serverTimestamp(),
  }).catch((error) =>
    // usually someone stored it a moment earlier; their poll counts
    console.warn('Featured poll not stored', error)
  );
  return poll;
}
