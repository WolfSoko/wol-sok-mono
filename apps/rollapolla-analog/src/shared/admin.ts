import { ChatMessage } from './chat.message';

/** Counted on demand by the admin page. */
export type AdminStats = {
  polls: number;
  listedPolls: number;
  openPolls: number;
  votes: number;
  lobbyMessages: number;
  /** Lobby and poll discussions together. */
  chatMessages: number;
  /**
   * Signed in with Google; the anonymous ones are counted apart. `null`
   * when Firebase Auth could not be counted: the rest still shows.
   */
  users: number | null;
  anonymousUsers: number | null;
  admins: number | null;
};

/** A Firebase Auth user who signed in with Google, as admins see them. */
export type AppUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  createdAt: Date;
  lastSignInAt: Date | null;
  isAdmin: boolean;
};

/** A page of users; ask with `nextPageToken` for the next, if not `null`. */
export type UsersPage = { users: AppUser[]; nextPageToken: string | null };

/** A chat message from the lobby (`pollId` null) or a poll's discussion. */
export type AdminChatMessage = ChatMessage & { pollId: string | null };

/** The first items of a list; `hasMore` when asking for more would find some. */
export type Page<T> = { items: T[]; hasMore: boolean };

/** The first `count` of `found`, which holds one more if there are more. */
export function toPage<T>(found: T[], count: number): Page<T> {
  return { items: found.slice(0, count), hasMore: found.length > count };
}
