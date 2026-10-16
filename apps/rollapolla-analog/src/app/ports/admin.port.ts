import { Observable } from 'rxjs';
import {
  AdminChatMessage,
  AdminStats,
  AppUser,
  Page,
} from '../../shared/admin';
import { FeatureFlag } from '../../shared/app-config';
import { Poll } from '../../shared/poll';
import { WriteReceipt } from './polls-repo.port';

/**
 * What only admins may do. An admin is a visitor signed in with Google whose
 * uid has a document in `admins`; the Firestore rules enforce every call.
 */
export abstract class AdminPort {
  /**
   * Whether the signed-in visitor is an admin, live. `false` when nobody or
   * an anonymous visitor is signed in, and always on the server.
   */
  abstract readonly isAdmin$: Observable<boolean>;

  /** Counts polls, votes, messages and users on the server. */
  abstract loadStats(): Promise<AdminStats>;

  /** All polls, listed or not, open or closed, newest first. */
  abstract watchAllPolls(counts: Observable<number>): Observable<Page<Poll>>;

  /** Deletes any poll. Its votes and messages expire with its TTL. */
  abstract deletePoll(pollId: string): WriteReceipt;

  /** Messages of the lobby and of all poll discussions, newest first. */
  abstract watchMessages(
    counts: Observable<number>
  ): Observable<Page<AdminChatMessage>>;

  abstract deleteMessage(message: AdminChatMessage): WriteReceipt;

  /** Visitors who signed in with Google, most recently seen first. */
  abstract watchUsers(counts: Observable<number>): Observable<Page<AppUser>>;

  /** Grants or revokes admin rights; nobody can revoke their own. */
  abstract setAdmin(uid: string, isAdmin: boolean): WriteReceipt;

  abstract setFeature(flag: FeatureFlag, enabled: boolean): WriteReceipt;
}
