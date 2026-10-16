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
  users: number;
  admins: number;
};

/** A visitor who signed in with Google, as the admin page lists them. */
export type AppUser = {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
  lastSeenAt: Date;
  isAdmin: boolean;
};

/** A chat message from the lobby (`pollId` null) or a poll's discussion. */
export type AdminChatMessage = ChatMessage & { pollId: string | null };

/** The first items of a list; `hasMore` when asking for more would find some. */
export type Page<T> = { items: T[]; hasMore: boolean };

/** The first `count` of `found`, which holds one more if there are more. */
export function toPage<T>(found: T[], count: number): Page<T> {
  return { items: found.slice(0, count), hasMore: found.length > count };
}
