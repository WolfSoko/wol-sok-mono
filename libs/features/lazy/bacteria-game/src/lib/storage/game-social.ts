import { Observable } from 'rxjs';
import type { Profile } from '../social/profile';

/** A friend's challenge to a match: the room it opened. */
export interface Challenge {
  from: string;
  code: string;
}

/** Where a player stands in the matchmaking queue. */
export interface QueueEntry {
  /** When the player joined the queue, by the server's clock - ms. */
  since: number | null;
  /** The last time the player said they still wait - ms, server clock. */
  seen: number | null;
  /** The room a newer player opened for them, null until one claims them. */
  claim: string | null;
}

/** A waiting player as others see them in the queue. */
export interface Waiting extends QueueEntry {
  uid: string;
}

/**
 * Everything players share with each other, keyed by their uids:
 * profiles, friend lists and requests, invitations, challenges and the
 * matchmaking queue - see ADR 0010. Only with the game's Firebase project
 * (`GameCloud.social`). Writes resolve once the server has them, and
 * reject when the rules refuse them; watchers emit again on every change
 * and nothing while the value cannot be read.
 */
export interface GameSocial {
  /** A player's stored profile, unparsed - null while they have none. */
  watchProfile(uid: string): Observable<unknown>;
  saveProfile(uid: string, profile: Profile): Promise<void>;

  /** The uids on a player's friend list. */
  watchFriends(uid: string): Observable<string[]>;
  /** True while `of` has `me` on their list. */
  watchListedBy(of: string, me: string): Observable<boolean>;
  /** Who asked to be friends with a player. */
  watchRequests(uid: string): Observable<string[]>;
  /** Puts `to` on `me`'s list and asks `to` to do the same. */
  sendRequest(me: string, to: string): Promise<void>;
  /** Puts the requester on `me`'s list and clears the request. */
  acceptRequest(me: string, from: string): Promise<void>;
  declineRequest(me: string, from: string): Promise<void>;
  /** Takes each off the other's list. */
  removeFriend(me: string, friend: string): Promise<void>;

  /** A new invitation from `me`; its token goes into the link. */
  createInvite(me: string): Promise<string>;
  /** Who made the invitation - null when there is none or it ran out. */
  readInvite(token: string): Promise<string | null>;
  /** Makes `me` and the inviter friends, on both lists. */
  acceptInvite(me: string, token: string, from: string): Promise<void>;

  /** Challenges a friend to the match in room `code`. */
  challenge(me: string, friend: string, code: string): Promise<void>;
  /** The challenges a player has, newest last. */
  watchChallenges(uid: string): Observable<Challenge[]>;
  /** Clears the challenge from `from` to `to` - either may. */
  clearChallenge(to: string, from: string): Promise<void>;

  /** Puts a player in the matchmaking queue, or keeps them there. */
  enqueue(uid: string): Promise<void>;
  /** Tells the queue the player still waits. */
  stillWaiting(uid: string): Promise<void>;
  leaveQueue(uid: string): Promise<void>;
  /** The player's own entry - null once it is gone. */
  watchQueueEntry(uid: string): Observable<QueueEntry | null>;
  /** The oldest players waiting, oldest first. */
  waiting(limit: number): Promise<Waiting[]>;
  /**
   * Hands a waiting player the room `code`, if nobody did before - true
   * when this claim got them.
   */
  claim(uid: string, by: string, code: string): Promise<boolean>;
}

/** What a player is up to, when they share it. */
export type PresenceState = 'online' | 'playing';

/**
 * Who is online, kept where a dropped connection clears it at once - the
 * Realtime Database (`GameCloud.presence`).
 */
export interface GamePresence {
  /** A player's state - null while they are offline or do not share it. */
  watch(uid: string): Observable<PresenceState | null>;
  /**
   * Shares this device's state for `uid` - null takes it back. It goes
   * when the connection does, and comes back with it.
   */
  set(uid: string, state: PresenceState | null): void;
}
