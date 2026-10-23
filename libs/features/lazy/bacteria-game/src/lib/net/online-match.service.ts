import { inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Observable, Subject } from 'rxjs';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import type { OpenRoom } from '../storage/game-rooms';
import { normalizeRoomCode } from '../storage/game-rooms';
import { Lockstep } from './lockstep';
import {
  NET_VERSION,
  NetMessage,
  OnlineSetup,
  OnlineStart,
  parseNetMessage,
} from './net-message';
import { PeerLink } from './peer-link';
import { errorCode } from '../storage/retry';

/** Where the lobby of an online match stands. */
export type OnlinePhase =
  /** Nothing under way. */
  | 'idle'
  /** The host opens a room. */
  | 'opening'
  /** The host waits for a guest to type the code in. */
  | 'waiting'
  /** The devices connect. */
  | 'connecting'
  /** Both devices are there - the host may start. */
  | 'connected';

/** The lobby as the player sees it. */
export interface OnlineLobby {
  phase: OnlinePhase;
  /** Who opened the room - null before anyone did. */
  role: 'host' | 'guest' | null;
  /** The room's code, for the host to pass on. */
  code: string | null;
  /** What went wrong last, or why the other device left - null if nothing. */
  notice: string | null;
  /** True for a match the matchmaking set up: the host starts at once. */
  auto: boolean;
}

/** Why an online connection ended. */
export type OnlineEnd = 'left' | 'lost';

/** What happens in an online match, for the game to follow. */
export type OnlineEvent =
  /** The other device is there. */
  | { type: 'connected'; seat: 0 | 1; auto: boolean }
  /** The host changed the next match's setup - for the guest. */
  | { type: 'setup'; setup: OnlineSetup }
  /** The host started a match - for the guest; see {@link takeStart}. */
  | { type: 'start'; start: OnlineStart }
  /** The connection is gone. */
  | { type: 'ended'; reason: OnlineEnd };

export const IDLE_LOBBY: OnlineLobby = {
  phase: 'idle',
  role: null,
  code: null,
  notice: null,
  auto: false,
};

/**
 * Online matches between two devices: the lobby - a room opened under a
 * code, joined by a guest - and then the connection, which carries the
 * setup, the start of each match and the lockstep's inputs.
 *
 * The host plays the left colony and sets the matches up; the guest plays
 * the right one and follows.
 */
@Injectable({ providedIn: 'root' })
export class OnlineMatchService {
  private readonly cloud = inject(GameCloud);
  /** Who plays at this device - their uid goes to the other one. */
  private readonly playerId = toSignal(
    inject(GameAccount).players.pipe(map(({ playerId }) => playerId)),
    { initialValue: null }
  );
  private readonly peerState = signal<string | null>(null);
  private readonly lobbyState = signal<OnlineLobby>(IDLE_LOBBY);
  private readonly events = new Subject<OnlineEvent>();
  private link: PeerLink | null = null;
  private room: OpenRoom | null = null;
  /** The lockstep of the match under way, null before the first one. */
  private lockstep: Lockstep | null = null;
  /** The number of the match under way - inputs of another are dropped. */
  private match = 0;
  /** A start the host sent that the guest's game has not taken yet. */
  private pendingStart: { start: OnlineStart; lockstep: Lockstep } | null =
    null;
  /** True once the other device said hello in this version. */
  private greeted = false;
  /** Counts the attempts to connect, so a stale one gives up. */
  private attempt = 0;

  public readonly lobby = this.lobbyState.asReadonly();
  /**
   * The uid of the player at the other device once they said hello - kept
   * after the connection, so the result can offer to add them as a friend.
   */
  public readonly peer = this.peerState.asReadonly();
  public readonly events$: Observable<OnlineEvent> = this.events.asObservable();

  /** True where online matches can be played: with the cloud and WebRTC. */
  public get available(): boolean {
    return PeerLink.supported() && this.cloud.rooms() !== null;
  }

  /**
   * Opens a room and waits for a guest. `onCode` hears the room's code as
   * soon as it is open - to challenge a friend with it, or hand it to a
   * player waiting in the matchmaking queue.
   */
  public async host(
    options: { auto?: boolean; onCode?: (code: string) => void } = {}
  ): Promise<void> {
    const rooms = this.cloud.rooms();
    if (rooms === null) {
      return;
    }
    const attempt = this.restart({
      phase: 'opening',
      role: 'host',
      auto: options.auto ?? false,
    });
    try {
      const { link, offer } = await PeerLink.offer();
      if (!this.adopt(link, attempt)) {
        return;
      }
      const room = await rooms.open(offer);
      if (attempt !== this.attempt) {
        room.close();
        return;
      }
      this.room = room;
      this.update({ phase: 'waiting', code: room.code });
      options.onCode?.(room.code);
      const answer = await room.answer;
      if (attempt !== this.attempt) {
        return;
      }
      this.update({ phase: 'connecting' });
      await link.accept(answer);
      await link.opened;
      // Taken: nobody else may join it.
      room.close();
      this.room = null;
    } catch (error) {
      this.fail(attempt, error);
    }
  }

  /** Joins the room under the code a player typed in. */
  public async join(
    typed: string,
    options: { auto?: boolean } = {}
  ): Promise<void> {
    const rooms = this.cloud.rooms();
    const code = normalizeRoomCode(typed);
    if (rooms === null) {
      return;
    }
    if (code === null) {
      this.update({ notice: 'A code has six letters and digits.' });
      return;
    }
    const attempt = this.restart({
      phase: 'connecting',
      role: 'guest',
      code,
      auto: options.auto ?? false,
    });
    try {
      const room = await rooms.join(code);
      if (attempt !== this.attempt) {
        return;
      }
      if (room === null) {
        this.endWith(attempt, 'There is no open match under that code.');
        return;
      }
      const { link, answer } = await PeerLink.answer(room.offer);
      if (!this.adopt(link, attempt)) {
        return;
      }
      await room.answer(answer);
      await link.opened;
    } catch (error) {
      if (errorCode(error) === 'permission-denied') {
        // Another guest answered the room first.
        this.endWith(attempt, 'Someone else joined that match first.');
        return;
      }
      this.fail(attempt, error);
    }
  }

  /** Leaves the room or the match, telling the other device. */
  public leave(): void {
    this.send({ k: 'bye' });
    this.restart(IDLE_LOBBY);
  }

  /** The host shares the setup of the next match with the guest. */
  public share(setup: OnlineSetup): void {
    if (this.lobby().role === 'host') {
      this.send({ k: 'setup', ...setup });
    }
  }

  /**
   * The host starts a match: tells the guest, and returns the lockstep to
   * play it with. Null while no guest is connected.
   */
  public startMatch(start: OnlineStart): Lockstep | null {
    if (this.lobby().role !== 'host' || this.lobby().phase !== 'connected') {
      return null;
    }
    this.match++;
    this.send({ k: 'start', n: this.match, ...start });
    this.lockstep = this.newLockstep(0);
    return this.lockstep;
  }

  /**
   * The guest's game takes the match the host started - null when none
   * waits.
   */
  public takeStart(): { start: OnlineStart; lockstep: Lockstep } | null {
    const pending = this.pendingStart;
    this.pendingStart = null;
    return pending;
  }

  /**
   * Lets go of whatever was under way and sets the lobby to `lobby` -
   * telling the game, for `reason`, if it was connected.
   */
  private restart(
    lobby: Partial<OnlineLobby>,
    reason: OnlineEnd = 'left'
  ): number {
    const wasConnected = this.greeted;
    this.attempt++;
    this.room?.close();
    this.room = null;
    const link = this.link;
    this.link = null;
    link?.close();
    this.lockstep = null;
    this.pendingStart = null;
    this.greeted = false;
    this.lobbyState.set({ ...IDLE_LOBBY, ...lobby });
    if (wasConnected) {
      this.events.next({ type: 'ended', reason });
    }
    return this.attempt;
  }

  /** Takes the link of an attempt - false when the attempt is over. */
  private adopt(link: PeerLink, attempt: number): boolean {
    if (attempt !== this.attempt) {
      link.close();
      return false;
    }
    this.link = link;
    link.messages$.subscribe((data) => this.receive(data));
    link.closed$.subscribe(() => this.onClosed(link));
    link.opened.then(
      () => this.send({ k: 'hello', v: NET_VERSION, id: this.playerId() }),
      () => undefined
    );
    return true;
  }

  private receive(data: string): void {
    const message = parseNetMessage(data);
    if (message === null) {
      return;
    }
    if (message.k === 'hello') {
      this.peerState.set(message.id);
      this.greet(message.v);
      return;
    }
    if (!this.greeted) {
      return;
    }
    const { role } = this.lobby();
    switch (message.k) {
      case 'setup':
        if (role === 'guest') {
          this.events.next({ type: 'setup', setup: setupOf(message) });
        }
        return;
      case 'start':
        if (role === 'guest') {
          this.match = message.n;
          this.lockstep = this.newLockstep(1);
          const start: OnlineStart = {
            ...setupOf(message),
            seed: message.seed,
          };
          this.pendingStart = { start, lockstep: this.lockstep };
          this.events.next({ type: 'start', start });
        }
        return;
      case 'in':
        if (message.n === this.match) {
          this.lockstep?.putRemote(message.t, message);
        }
        return;
      case 'sum':
        if (message.n === this.match) {
          this.lockstep?.putRemoteSum(message.t, message.h);
        }
        return;
      case 'bye':
        this.endWith(this.attempt, 'Your opponent left.', 'left');
        return;
    }
  }

  private greet(version: string): void {
    if (version !== NET_VERSION) {
      this.endWith(
        this.attempt,
        'Your opponent plays another version of the game - reload both.'
      );
      return;
    }
    if (this.greeted) {
      return;
    }
    this.greeted = true;
    this.update({ phase: 'connected', notice: null });
    const { role, auto } = this.lobby();
    this.events.next({
      type: 'connected',
      seat: role === 'host' ? 0 : 1,
      auto,
    });
  }

  private onClosed(link: PeerLink): void {
    if (link === this.link) {
      this.endWith(
        this.attempt,
        'The connection to your opponent was lost.',
        'lost'
      );
    }
  }

  private fail(attempt: number, error: unknown): void {
    console.warn('The online match could not connect', error);
    this.endWith(
      attempt,
      'Could not connect. Try again - on the same Wi-Fi it works best.'
    );
  }

  /** Ends the attempt with a notice, telling the game if it was connected. */
  private endWith(
    attempt: number,
    notice: string,
    reason: OnlineEnd = 'lost'
  ): void {
    if (attempt !== this.attempt) {
      return;
    }
    this.restart({ notice }, reason);
  }

  private newLockstep(seat: 0 | 1): Lockstep {
    const match = this.match;
    return new Lockstep(
      seat,
      (message) => {
        // A match that was replaced sends nothing more.
        if (match === this.match) {
          this.send(message);
        }
      },
      match
    );
  }

  private send(message: NetMessage): void {
    this.link?.send(JSON.stringify(message));
  }

  private update(change: Partial<OnlineLobby>): void {
    this.lobbyState.update((lobby) => ({ ...lobby, ...change }));
  }
}

function setupOf({ levelId, colors }: OnlineSetup): OnlineSetup {
  return { levelId, colors };
}
