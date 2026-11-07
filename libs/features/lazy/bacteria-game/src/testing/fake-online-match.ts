import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { Ruleset } from '@wolsok/feat-shared-bacteria-engine';
import { Lockstep } from '../lib/net/lockstep';
import type { OnlineStart } from '../lib/net/net-message';
import {
  IDLE_LOBBY,
  type OnlineEvent,
  type OnlineLobby,
  type OnlineMatchRef,
  type OnlineMatchService,
} from '../lib/net/online-match.service';

/**
 * The online match without a network, for specs of what uses it: the spec
 * plays the other device - `connect` it, push `events`, leave a start in
 * `pending` - and checks what the code under test called. Every method is
 * a `jest.fn`.
 *
 * Provide it as `{ provide: OnlineMatchService, useValue: online }`. To
 * play the protocol itself, use two real services over `pairedTransport()`.
 */
export class FakeOnlineMatch implements Pick<
  OnlineMatchService,
  keyof OnlineMatchService
> {
  /** The room's code: what `host` opens and `matchRef` names. */
  public readonly code: string;
  public readonly available: boolean;
  public readonly lobby = signal<OnlineLobby>(IDLE_LOBBY);
  public readonly peer = signal<string | null>(null);
  /** What the spec tells the game, as the other device would. */
  public readonly events = new Subject<OnlineEvent>();
  public readonly events$ = this.events.asObservable();
  /** A start the host sent, for the guest's `takeStart`. */
  public pending: ReturnType<OnlineMatchService['takeStart']> = null;

  /** The seat of the last {@link connect} - what `startMatch` plays. */
  private seat: 0 | 1 = 0;

  public constructor(options: { code?: string; available?: boolean } = {}) {
    this.code = options.code ?? 'K7QPXM';
    this.available = options.available ?? true;
  }

  /** Opens the room under {@link code} at once and waits there. */
  public readonly host = jest.fn(
    async (
      options: { auto?: boolean; onCode?: (code: string) => void } = {}
    ) => {
      this.lobby.set({
        ...IDLE_LOBBY,
        phase: 'waiting',
        role: 'host',
        code: this.code,
        auto: options.auto ?? false,
      });
      options.onCode?.(this.code);
    }
  );

  /** Starts to connect to the room under `code`. */
  public readonly join = jest.fn(
    async (code: string, options: { auto?: boolean } = {}) => {
      this.lobby.set({
        ...IDLE_LOBBY,
        phase: 'connecting',
        role: 'guest',
        code,
        auto: options.auto ?? false,
      });
    }
  );

  public readonly leave = jest.fn(() => this.lobby.set(IDLE_LOBBY));
  public readonly share = jest.fn();
  public readonly offerColors = jest.fn();
  /** A lockstep for the connected seat, sending nowhere. */
  public readonly startMatch = jest.fn(
    (_start: OnlineStart): Lockstep | null =>
      new Lockstep(this.seat, () => undefined)
  );
  public readonly agreedRuleset = jest.fn((): Ruleset => 'cpu');
  public readonly matchRef = jest.fn((): OnlineMatchRef | null => ({
    roomCode: this.code,
    n: 1,
  }));

  public takeStart(): ReturnType<OnlineMatchService['takeStart']> {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }

  /** The other device is there: this one plays `seat`. */
  public connect(seat: 0 | 1, auto = false): void {
    this.seat = seat;
    this.lobby.set({
      phase: 'connected',
      role: seat === 0 ? 'host' : 'guest',
      code: null,
      notice: null,
      auto,
    });
    this.events.next({ type: 'connected', seat, auto });
  }
}
