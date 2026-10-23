import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameCloud } from '../storage/game-cloud';
import type { GameSocial, Waiting } from '../storage/game-social';
import { SocialService } from '../social/social.service';
import { OnlineMatchService } from './online-match.service';

/** How often a waiting player tries to claim an older one. */
const CLAIM_EVERY_MS = 3000;
/** How often a waiting player tells the queue they are still there. */
const STILL_WAITING_EVERY_MS = 15_000;
/** An entry not refreshed for this long belongs to a player who left. */
const STALE_MS = 45_000;
/** How long a host waits for the player it claimed to join. */
const JOIN_TIMEOUT_MS = 20_000;
/** How many of the oldest entries a claim looks at. */
const LOOK_AT = 10;

/** Where the search for an opponent stands. */
export type MatchmakingState = 'idle' | 'searching' | 'found';

/**
 * Finds an opponent for an online match without a server (ADR 0010): the
 * player waits in the queue, and the newer of two waiting players opens a
 * room and hands its code to the older one, who joins it. Only newer
 * players claim older ones, so two never wait for each other.
 */
@Injectable({ providedIn: 'root' })
export class MatchmakerService {
  private readonly social: GameSocial | null = inject(GameCloud).social();
  private readonly players = inject(SocialService);
  private readonly online = inject(OnlineMatchService);
  private readonly stateSignal = signal<MatchmakingState>('idle');
  private watching: Subscription | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private joinTimeout: ReturnType<typeof setTimeout> | null = null;
  /** When the player's own entry joined the queue, and was last refreshed. */
  private own: { since: number | null; seen: number | null } = {
    since: null,
    seen: null,
  };
  private claiming = false;
  /** Counts the searches, so one that was stopped meanwhile gives up. */
  private run = 0;

  public readonly state = this.stateSignal.asReadonly();
  public readonly available = this.social !== null && this.online.available;

  public constructor() {
    // Found and connected: the search is over. Found and the connection
    // failed before the match: back into the queue.
    let last = this.online.lobby().phase;
    effect(() => {
      const { phase } = this.online.lobby();
      const before = last;
      last = phase;
      untracked(() => {
        if (this.stateSignal() !== 'found' || phase === before) {
          return;
        }
        if (phase === 'connected') {
          this.clearJoinTimeout();
          this.stateSignal.set('idle');
        } else if (phase === 'idle') {
          this.clearJoinTimeout();
          void this.search();
        }
      });
    });
  }

  /** Starts looking for an opponent. */
  public async find(): Promise<void> {
    if (!this.available || this.stateSignal() !== 'idle') {
      return;
    }
    this.online.leave();
    await this.search();
  }

  /** Stops looking - and gives up a room opened for a claimed player. */
  public async cancel(): Promise<void> {
    const wasFound = this.stateSignal() === 'found';
    this.stop();
    this.clearJoinTimeout();
    this.stateSignal.set('idle');
    if (wasFound && this.online.lobby().phase !== 'connected') {
      this.online.leave();
    }
    await this.leaveQueue();
  }

  private async search(): Promise<void> {
    const me = this.players.uid();
    const social = this.social;
    if (me === null || social === null) {
      this.stateSignal.set('idle');
      return;
    }
    this.stop();
    this.clearJoinTimeout();
    const run = this.run;
    this.stateSignal.set('searching');
    this.own = { since: null, seen: null };
    try {
      await social.enqueue(me);
    } catch (error) {
      console.warn('Could not join the matchmaking queue', error);
      if (run === this.run) {
        this.stateSignal.set('idle');
      }
      return;
    }
    if (run !== this.run) {
      // Cancelled while joining: the entry goes again.
      if (this.stateSignal() === 'idle') {
        await social.leaveQueue(me).catch(() => undefined);
      }
      return;
    }
    this.watching = social.watchQueueEntry(me).subscribe((entry) => {
      if (entry === null || this.stateSignal() !== 'searching') {
        return;
      }
      this.own = { since: entry.since, seen: entry.seen };
      if (entry.claim !== null) {
        // An older player's turn ends here: a newer one opened a room.
        this.found();
        void social.leaveQueue(me);
        void this.online.join(entry.claim, { auto: true });
      }
    });
    this.timers = [
      setInterval(() => void this.tryClaim(me, social), CLAIM_EVERY_MS),
      setInterval(
        () => void social.stillWaiting(me).catch(() => undefined),
        STILL_WAITING_EVERY_MS
      ),
    ];
    void this.tryClaim(me, social);
  }

  /**
   * Claims the oldest player waiting before this one: opens a room and
   * hands them its code.
   */
  private async tryClaim(me: string, social: GameSocial): Promise<void> {
    const { since, seen } = this.own;
    if (
      this.claiming ||
      this.stateSignal() !== 'searching' ||
      since === null ||
      seen === null
    ) {
      return;
    }
    this.claiming = true;
    try {
      const waiting = await social.waiting(LOOK_AT, seen - STALE_MS);
      const candidates = waiting.filter((entry) =>
        claimable(entry, me, since, seen)
      );
      if (candidates.length === 0 || this.stateSignal() !== 'searching') {
        return;
      }
      const code = await this.openRoom();
      if (code === null) {
        return;
      }
      for (const candidate of candidates) {
        if (this.stateSignal() !== 'searching') {
          return;
        }
        if (await social.claim(candidate.uid, me, code).catch(() => false)) {
          this.found();
          this.joinTimeout = setTimeout(() => {
            this.joinTimeout = null;
            // They never came - a closed tab: on with the search.
            if (
              this.stateSignal() === 'found' &&
              this.online.lobby().phase !== 'connected'
            ) {
              this.online.leave();
            }
          }, JOIN_TIMEOUT_MS);
          await social.leaveQueue(me).catch(() => undefined);
          return;
        }
      }
      // Everyone was taken: the room goes, the search goes on.
      this.online.leave();
    } catch (error) {
      console.warn('Could not claim a waiting player', error);
    } finally {
      this.claiming = false;
    }
  }

  /** Opens a room for an automatic match - its code, null if that failed. */
  private openRoom(): Promise<string | null> {
    return new Promise((resolve) => {
      let opened = false;
      void this.online
        .host({
          auto: true,
          onCode: (code) => {
            opened = true;
            resolve(code);
          },
        })
        .finally(() => {
          if (!opened) {
            resolve(null);
          }
        });
    });
  }

  private found(): void {
    this.stop();
    this.stateSignal.set('found');
  }

  private stop(): void {
    this.run++;
    this.watching?.unsubscribe();
    this.watching = null;
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  private clearJoinTimeout(): void {
    if (this.joinTimeout !== null) {
      clearTimeout(this.joinTimeout);
      this.joinTimeout = null;
    }
  }

  private async leaveQueue(): Promise<void> {
    const me = this.players.uid();
    if (me !== null) {
      await this.social?.leaveQueue(me).catch(() => undefined);
    }
  }
}

/**
 * True for an entry this player may claim: someone else's, unclaimed,
 * older than the player's own and refreshed lately - by the server's clock,
 * which both entries carry.
 */
export function claimable(
  entry: Waiting,
  me: string,
  since: number,
  seen: number
): boolean {
  return (
    entry.uid !== me &&
    entry.claim === null &&
    entry.since !== null &&
    entry.since < since &&
    entry.seen !== null &&
    entry.seen >= seen - STALE_MS
  );
}
