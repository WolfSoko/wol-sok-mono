import { inject, Injectable, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { GameCloud } from './game-cloud';

/** Who plays, as the profile shows them. */
export interface PlayerProfile {
  /**
   * True for a guest account, one nobody has signed in to - with Google,
   * or with Play Games in the Android app.
   */
  guest: boolean;
  /**
   * The name of the account signed in to (Google's, or the Play Games
   * player's), null for a guest.
   */
  name: string | null;
  /** The photo of the Google account, where it has one. */
  photoUrl?: string;
}

/** A player taking over the game: at the start, after a sign-in or sign-out. */
export interface PlayerSwitch {
  /**
   * Names the player, the same on every device they sign in on - null
   * between a sign-out and the next guest, when nobody plays.
   */
  playerId: string | null;
  /**
   * True when the player signed in on this device to an account that has
   * progress of its own: what they played as a guest here joins it, once.
   */
  adoptsGuest: boolean;
}

/** How a sign-in ended. */
export type SignInOutcome = 'signed-in' | 'cancelled' | 'failed';

/**
 * Whose game it is. The game's progress follows the player: `GameStorage`
 * answers for whoever plays, and the services start over on a switch
 * rather than carry one player's medallions over to the next.
 *
 * Without the cloud the device is the one and only player.
 */
@Injectable({
  providedIn: 'root',
  useFactory: () => inject(GameCloud).account(),
})
export abstract class GameAccount {
  /** False when everything stays on this device - there is no sign-in. */
  public abstract readonly cloud: boolean;

  /** Who plays, null until it is known. */
  public abstract readonly profile: Signal<PlayerProfile | null>;

  /**
   * True while the owner plays: the `admin` claim, a verified email and a
   * Google sign-in in the current token, the facts the rules' `isAdmin()`
   * checks (ADR 0012). It only shows the way to the admin area, which
   * checks again with a fresh token; the rules are the lock.
   */
  public abstract readonly owner: Signal<boolean>;

  /**
   * Who plays, and again on every switch. The first player is the one the
   * visit started with; the storage answers for them from then on.
   */
  public abstract readonly players: Observable<PlayerSwitch>;

  /**
   * Signs in with Google. A guest's account becomes the Google account, so
   * nothing switches - unless the Google account has played elsewhere
   * already: then it takes over, and adopts what the guest played here.
   */
  public abstract signIn(): Promise<SignInOutcome>;

  /**
   * Signs in with a custom token the functions answered a Play Games
   * sign-in with (#3175): the session is no guest's any more. For another
   * account than the one playing, that one takes over and adopts what the
   * guest played here. Only while `writer`, the player the sign-in was
   * sent for, still plays: a token that arrives after a switch or a
   * sign-out is dropped. False when nothing was signed in to.
   */
  public abstract signInWithToken(
    token: string,
    writer: string
  ): Promise<boolean>;

  /** Signs out of Google; a new guest plays on, from the start. */
  public abstract signOut(): Promise<void>;
}
