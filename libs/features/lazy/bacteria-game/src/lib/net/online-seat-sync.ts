import { Injectable, inject } from '@angular/core';
import {
  getLevel,
  LEVELS,
  onlineColors,
  playableOnline,
  randomSeed,
  type Ruleset,
  sameColors,
  seatFirst,
} from '@wolsok/feat-shared-bacteria-engine';
import { Observable, Subject } from 'rxjs';
import {
  GameStateState,
  GameStateStore,
  OnlineSeat,
} from '../state/game.states';
import type { Lockstep } from './lockstep';
import type { OnlineSetup } from './net-message';
import {
  OnlineEvent,
  OnlineMatchRef,
  OnlineMatchService,
} from './online-match.service';

/**
 * What the online seat changed: a patch of the game's state - the seat,
 * the setup of the next match - after which the idle board is spawned
 * anew, a respawn alone, or the end of the connection.
 */
export type SeatChange =
  | { kind: 'patch'; patch: Partial<GameStateState> }
  | { kind: 'respawn' }
  | { kind: 'ended' };

/** An online match about to start: its seed, lockstep and agreed ruleset. */
export interface OnlineMatchStart {
  seed: number;
  lockstep: Lockstep;
  ruleset: Ruleset;
  /** Its room and number there - null before the room's first match. */
  ref: OnlineMatchRef | null;
  /** The seat to play it on - the guest's with the host's setup. */
  seat: OnlineSeat;
}

/**
 * Keeps this device's online seat in step with the other device: who sits
 * where, the level and the colours of the next match. The host makes the
 * pair of colours from its own and the guest's pick and shares the setup;
 * the guest offers its pick and plays what it is sent. It reads the game's
 * state and hands its changes on through {@link changes$}, for the game to
 * apply.
 */
@Injectable({ providedIn: 'root' })
export class OnlineSeatSync {
  private readonly store = inject(GameStateStore);
  private readonly online = inject(OnlineMatchService);
  private readonly changes = new Subject<SeatChange>();
  /**
   * The guest's word of its own colours, null before it came - what the
   * host makes the online pair from, with its own.
   */
  private guestColors: [string, string] | null = null;

  /** The seat's changes, in the order they come. */
  public readonly changes$: Observable<SeatChange> =
    this.changes.asObservable();

  public constructor() {
    this.online.events$.subscribe((event) => this.follow(event));
  }

  /** True while an online connection is under way, or being made. */
  public get connected(): boolean {
    return this.online.lobby().phase !== 'idle';
  }

  /**
   * Tells the other device what the setup now is, changed from `previous`:
   * the guest offers its own colours, the host shares the next match.
   * Returns the patch of the host's seat - null when it stays as it is.
   */
  public setupChanged(
    previous: GameStateState
  ): Partial<GameStateState> | null {
    const { online, colors } = this.store.snapshot();
    // The guest's colours are its own pick: the host makes the pair of
    // the match from them.
    if (online?.seat === 1 && colors !== previous.colors) {
      this.online.offerColors(colors);
    }
    return this.hostSetup();
  }

  /**
   * The online match to start: the host picks the seed and tells the guest,
   * the guest takes the match the host started - and neither starts one on
   * its own. Null when there is none to start.
   */
  public matchStart(seat: OnlineSeat): OnlineMatchStart | null {
    if (seat.seat === 0) {
      const seed = randomSeed();
      const ruleset = this.online.agreedRuleset();
      const lockstep = this.online.startMatch({
        levelId: seat.levelId,
        colors: seat.colors,
        seed,
        ruleset,
      });
      return lockstep === null
        ? null
        : { seed, lockstep, ruleset, ref: this.online.matchRef(), seat };
    }
    const taken = this.online.takeStart();
    if (taken === null) {
      return null;
    }
    const { levelId, colors, seed, ruleset } = taken.start;
    return {
      seed,
      lockstep: taken.lockstep,
      ruleset,
      ref: this.online.matchRef(),
      seat: { ...seat, levelId, colors },
    };
  }

  /**
   * Leaves the connection. The game takes its seat away first: the match
   * goes with the connection, and whoever leaves wins nothing.
   */
  public leave(): void {
    this.guestColors = null;
    this.online.leave();
  }

  /** Follows the online match: the lobby, the host's setup, the connection. */
  private follow(event: OnlineEvent): void {
    switch (event.type) {
      case 'connected':
        this.patch(this.seated(event.seat));
        return;
      case 'colors':
        if (this.store.snapshot().online?.seat === 0) {
          this.guestColors = event.colors;
          // Spawned anew even when the pair stays: the board shows the
          // match the guest will play.
          const patch = this.hostSetup();
          this.changes.next(
            patch === null ? { kind: 'respawn' } : { kind: 'patch', patch }
          );
        }
        return;
      case 'setup': {
        const { online } = this.store.snapshot();
        if (online !== null && !sameSetup(online, event.setup)) {
          this.patch({ online: { ...online, ...event.setup } });
        }
        return;
      }
      case 'ended':
        this.guestColors = null;
        this.changes.next({ kind: 'ended' });
        return;
      case 'start':
        // The game starts the match - see `matchStart`.
        return;
    }
  }

  /**
   * Takes the seat the connection gave this device, on a level that plays
   * online. The guest waits for the host's pair in its own colour - and tells the host
   * what it picked, for the host to make the pair from.
   */
  private seated(seat: 0 | 1): Partial<GameStateState> {
    const state = this.store.snapshot();
    const levelId = playableOnline(getLevel(state.levelId))
      ? state.levelId
      : LEVELS[0].id;
    this.guestColors = null;
    if (seat === 0) {
      const colors = onlineColors(state.colors, null);
      this.online.share({ levelId, colors });
      return { levelId, online: { seat, levelId, colors } };
    }
    this.online.offerColors(state.colors);
    const colors = seatFirst(state.colors, 1);
    return { levelId, online: { seat, levelId, colors } };
  }

  /**
   * The host's setup of the next match, shared with the guest when it
   * changed - the patch of the host's seat, null when it did not.
   */
  private hostSetup(): Partial<GameStateState> | null {
    const { online, levelId, colors } = this.store.snapshot();
    // The pair is made here and only here: the guest plays what it is sent.
    const setup = { levelId, colors: onlineColors(colors, this.guestColors) };
    if (online?.seat !== 0 || sameSetup(online, setup)) {
      return null;
    }
    this.online.share(setup);
    return { online: { ...online, ...setup } };
  }

  private patch(patch: Partial<GameStateState> | null): void {
    if (patch !== null) {
      this.changes.next({ kind: 'patch', patch });
    }
  }
}

/** True when two online setups set the same match up. */
function sameSetup(a: OnlineSetup, b: OnlineSetup): boolean {
  return a.levelId === b.levelId && sameColors(a.colors, b.colors);
}
