import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HudState } from '../hud/hud-state';
import { MatchmakerService } from '../net/matchmaker.service';
import { OnlineMatchService } from '../net/online-match.service';
import type { InviteOffer } from '../social/social-notices.component';
import {
  ChallengeView,
  FriendView,
  SocialService,
} from '../social/social.service';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { pickMatchLevel } from '../state/match-level';
import { PlayFlow } from './play-flow';

/**
 * Online play on the stage, and what links bring in: hosting and joining a
 * match, a friend's challenge, the matchmaking's matches, the host's starts
 * the guest follows, and the shared run or the invitation a link carries.
 * Provided by the stage component, one per stage; {@link start} sets it
 * going.
 */
@Injectable()
export class OnlineFlow {
  private readonly store = inject(GameStateStore);
  private readonly gameStateService = inject(GameStateService);
  private readonly online = inject(OnlineMatchService);
  private readonly matchmaker = inject(MatchmakerService);
  private readonly social = inject(SocialService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hud = inject(HudState);
  private readonly flow = inject(PlayFlow);

  /** The lobby of an online match, for the new game's start. */
  public readonly lobby = this.online.lobby;
  public readonly available = this.online.available;
  /** An invitation link opened on this visit, until it is answered. */
  public readonly inviteOffer = signal<InviteOffer | null>(null);
  /**
   * The start of a match that came in while this device still cleared the
   * last one - the host's, or the matchmaking's - played once it is clear.
   */
  private pendingStart: (() => void) | null = null;

  /**
   * Takes what the link brought - a shared run, an invitation - and follows
   * the online match's starts from now on.
   */
  public start(): void {
    void this.takeChallenge();
    void this.takeInvite();
    // The guest of an online match plays what the host starts.
    this.online.events$
      .pipe(
        filter((event) => event.type === 'start'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.followOnlineStart());
    // The host of a match the matchmaking set up starts it at once.
    this.online.events$
      .pipe(
        filter(
          (event) =>
            event.type === 'connected' && event.auto && event.seat === 0
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.startMatchmadeMatch());
    // A start that came in while the arena was cleared plays once it is.
    this.flow.arenaCleared$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const start = this.pendingStart;
        this.pendingStart = null;
        start?.();
      });
  }

  /** Takes a friend's challenge: on to the online lobby, into their room. */
  public playChallenge(call: ChallengeView): void {
    this.flow.openNewGameOn({ kind: 'online', step: 'start' });
    void this.online.join(call.code);
  }

  /** Challenges a friend from the friends screen: on to the online lobby. */
  public challengeFriend(friend: FriendView): void {
    if (this.lobby().phase !== 'idle') {
      return;
    }
    this.flow.openNewGameOn({ kind: 'online', step: 'start' });
    this.social.challengeFriend(friend);
  }

  /** Opens an online match for a friend to join. */
  public host(): void {
    void this.online.host();
  }

  /** Joins a friend's online match under the code they passed on. */
  public join(code: string): void {
    void this.online.join(code);
  }

  /** Leaves the online match, or its lobby. */
  public leave(): void {
    this.gameStateService.leaveOnline();
  }

  /**
   * Starts an automatic online match on the level the matchmaking picked -
   * a random level that plays online if it has none - once the arena is
   * clear, as the reset under way would end the match.
   */
  private startMatchmadeMatch(): void {
    this.gameStateService.setLevel(
      this.matchmaker.matchLevel()?.levelId ??
        pickMatchLevel(null, null, Math.random).levelId
    );
    if (this.flow.resetting()) {
      this.pendingStart = () => this.startOnlineMatch(0);
      return;
    }
    this.flow.startGame();
  }

  /**
   * Starts the match the host of an online match started - once the arena
   * is clear: a result on screen is cleared first.
   */
  private followOnlineStart(): void {
    const resetting = this.flow.resetting();
    if (resetting || this.hud.matchOver()) {
      this.pendingStart = () => this.startOnlineMatch(1);
      if (!resetting) {
        // Not resetGame: that gives the online match up.
        this.flow
          .resetGame$()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();
      }
      return;
    }
    this.startOnlineMatch(1);
  }

  /** Starts the online match this device plays in `seat`. */
  private startOnlineMatch(seat: 0 | 1): void {
    // Not once this device has left - it would start a match of its own.
    if (this.store.snapshot().online?.seat === seat) {
      this.flow.startGame();
    }
  }

  /**
   * Takes the run a link carries in its hash as a challenge, and takes it
   * out of the address, so a reload or a bookmark does not offer it again.
   */
  private async takeChallenge(): Promise<void> {
    if (
      !(await this.gameStateService.offerChallenge(this.document.location.hash))
    ) {
      return;
    }
    await this.dropHash();
  }

  /**
   * Takes the invitation a link carries in its hash (`#friend=<token>`)
   * and offers to add the inviter as a friend - and, once it is read,
   * takes it out of the address, so a reload does not offer it again.
   */
  private async takeInvite(): Promise<void> {
    const match = /^#friend=([a-z2-9]{20})$/.exec(this.document.location.hash);
    if (match === null || !this.social.available) {
      return;
    }
    const token = match[1];
    let from: string | null;
    try {
      from = await this.social.readInvite(token);
    } catch {
      // Kept in the address, so a reload reads the invitation again.
      return;
    }
    await this.dropHash();
    if (from !== null) {
      this.inviteOffer.set({ token, from });
    }
  }

  /** Takes the hash out of the address - through the router, which holds it. */
  private async dropHash(): Promise<void> {
    await this.router.navigateByUrl(this.router.url.split('#')[0], {
      replaceUrl: true,
    });
  }
}
