import { Observable } from 'rxjs';
import {
  AdminChatMessage,
  AdminStats,
  AppUser,
  Page,
  UsersPage,
} from '../../shared/admin';
import { FeatureFlag } from '../../shared/app-config';
import { Poll } from '../../shared/poll';
import { WriteReceipt } from './polls-repo.port';

/**
 * What only admins may do. An admin is a visitor signed in with Google whose
 * Firebase Auth user carries the `admin` custom claim; the Firestore rules and
 * the admin API (src/server/admin) check it on every call.
 */
export abstract class AdminPort {
  /**
   * Whether the signed-in visitor is an admin, live. `false` when nobody or
   * an anonymous visitor is signed in, and always on the server.
   */
  abstract readonly isAdmin$: Observable<boolean>;

  /**
   * Fetches a fresh sign-in token, so a claim granted or revoked a moment ago
   * applies now instead of within the hour; {@link isAdmin$} follows.
   */
  abstract recheckAdmin(): Promise<void>;

  /** Counts polls, votes and messages, and the users in Firebase Auth. */
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

  /** Users who signed in with Google, a page at a time, in Firebase Auth's order. */
  abstract loadUsers(pageToken?: string): Promise<UsersPage>;

  /**
   * Grants or revokes admin rights and resolves with the user as they are
   * now. Nobody can revoke their own. The user's sign-in token picks the
   * change up within the hour, or at once if their browser rechecks.
   */
  abstract setAdmin(uid: string, isAdmin: boolean): Promise<AppUser>;

  abstract setFeature(flag: FeatureFlag, enabled: boolean): WriteReceipt;
}
