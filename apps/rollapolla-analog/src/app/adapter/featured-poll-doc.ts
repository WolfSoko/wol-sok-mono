import { doc, Firestore, setDoc } from '@angular/fire/firestore';
import { featuredPoll, featuredPollDraft } from '../../shared/featured-polls';
import { Poll } from '../../shared/poll';
import { pollConverter } from './poll.converter';

/**
 * Stores a featured poll nobody has voted on or chatted about yet, and returns
 * it as stored. Not awaited by callers: writes from one client reach the
 * backend in order, so a vote or message written next finds the poll.
 */
export function saveFeaturedPoll(fs: Firestore, unsaved: Poll): Poll {
  const featured = featuredPoll(unsaved.id);
  if (!featured) {
    throw new Error(`Not a featured poll: ${unsaved.id}`);
  }
  // created now, so the rules' check on createdAt passes however long the
  // visitor looked at the draft
  const poll: Poll = featuredPollDraft(featured);
  delete poll.unsaved;
  setDoc(doc(fs, 'polls', poll.id).withConverter(pollConverter), poll).catch(
    (error) =>
      // usually someone stored it a moment earlier; their poll counts
      console.warn('Featured poll not stored', error)
  );
  return poll;
}
