import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { playGamesCodeOf } from '@wolsok/feat-shared-bacteria-engine/cloud';
import { dropHash } from '../flow/drop-hash';
import { hashLinks } from '../flow/hash-links';
import { SignIn } from '../guest/sign-in.service';
import { GameCloud } from '../storage/game-cloud';

/**
 * The Play Games sign-in of the Android app (#3175): the app launches the
 * game with a one-time code of Play Games in the hash
 * (`#play-games=<code>`), at every start. The handover takes it out of the
 * address at once, sends it to the functions and signs in with the token
 * they answer - the player's account, from now on in the app on any phone.
 * Silent: without an answer the game plays on as it is.
 * Provided per stage, like the other parts that take links.
 */
@Injectable()
export class PlayGamesHandover {
  private readonly cloud = inject(GameCloud);
  private readonly signIn = inject(SignIn);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  /** True while a code is on its way: the app hands one per start. */
  private busy = false;
  /** The newest code that came while another was on its way. */
  private waiting: string | null = null;

  /** Takes the code of the start, and of every start of the running game. */
  public start(): void {
    hashLinks(this.document)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((hash) => void this.take(hash));
  }

  private async take(hash: string): Promise<void> {
    const code = playGamesCodeOf(hash);
    if (code === null) {
      return;
    }
    // Out of the address before anything else: a code is used once, and a
    // shared or reloaded address must never carry it.
    await dropHash(this.router);
    if (this.busy) {
      // Sent once the one on its way is done, should that one fail.
      this.waiting = code;
      return;
    }
    this.busy = true;
    try {
      let next: string | null = code;
      while (next !== null) {
        this.waiting = null;
        next = (await this.hand(next)) ? null : this.waiting;
      }
    } finally {
      this.busy = false;
      this.waiting = null;
    }
  }

  /** Sends one code; true once the functions answered it. */
  private async hand(code: string): Promise<boolean> {
    const playGames = this.cloud.playGames();
    if (playGames === null) {
      return true;
    }
    const answer = await playGames.signIn(code);
    if (answer === null) {
      return false;
    }
    if (answer.token !== null) {
      await this.signIn.signInWithToken(answer.token, answer.writer);
    } else if (!answer.ok) {
      console.info('Play Games sign-in refused', answer.error);
    }
    return true;
  }
}
