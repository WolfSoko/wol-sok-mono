import { computed, inject, Injectable, signal } from '@angular/core';
import { GameStateStore } from '../state/game.states';
import type { GuestRoomState } from './net-message';
import { type OnlineEvent, OnlineMatchService } from './online-match.service';

/** The guest's word as the room shows it, for the level set now. */
export interface GuestRoomView {
  /** The level the guest would like next - null for none or the one set. */
  wish: string | null;
  /** True while the guest is ready for the level set. */
  ready: boolean;
}

export const NOTHING_SAID: GuestRoomState = { wish: null, readyFor: null };

/** What moves the guest's word on, besides the guest itself. */
export type GuestRoomEvent =
  /** The host set `levelId` up for the next match. */
  | { type: 'setup'; levelId: string }
  /** A match started. */
  | { type: 'start' };

/**
 * The guest's word after `event`: a wish the host took is fulfilled, ready
 * for another level than the one set no longer holds, and ready was for
 * the match that started.
 */
export function guestRoomAfter(
  word: GuestRoomState,
  event: GuestRoomEvent
): GuestRoomState {
  if (event.type === 'start') {
    return { ...word, readyFor: null };
  }
  const { levelId } = event;
  return {
    wish: word.wish === levelId ? null : word.wish,
    readyFor: word.readyFor === levelId ? levelId : null,
  };
}

/**
 * The guest's word for the level set now, `levelId`: both seats show it
 * so, so a host that just picked another level shows no stale ready.
 */
export function viewOf(
  word: GuestRoomState,
  levelId: string | null
): GuestRoomView {
  return {
    wish: word.wish === levelId ? null : word.wish,
    ready: word.readyFor !== null && word.readyFor === levelId,
  };
}

function sameWord(a: GuestRoomState, b: GuestRoomState): boolean {
  return a.wish === b.wish && a.readyFor === b.readyFor;
}

/**
 * What the guest says in the online room - the level it would like next,
 * and whether it is ready - for both seats (feature `room`). The guest
 * changes it and tells the host; the host shows what it was told. Neither
 * changes the level or starts a match: picking and starting stay the
 * host's.
 */
@Injectable({ providedIn: 'root' })
export class GuestRoom {
  private readonly online = inject(OnlineMatchService);
  private readonly store = inject(GameStateStore);
  /** The guest's own word, at the guest. */
  private readonly word = signal<GuestRoomState>(NOTHING_SAID);
  /** What the guest told the host, at the host. */
  private readonly heard = signal<GuestRoomState>(NOTHING_SAID);

  /** True where the guest can speak: connected to a peer that understands the room. */
  public readonly available = computed(() => this.online.peerHas('room'));

  /** The guest's wish and ready for the level set now, on either seat. */
  public readonly state = computed(() =>
    viewOf(
      this.online.lobby().role === 'guest' ? this.word() : this.heard(),
      this.levelId()
    )
  );

  public constructor() {
    this.online.events$.subscribe((event) => this.follow(event));
  }

  /**
   * The guest wishes `levelId` for the next match - or takes the wish back
   * when it is the one it wished. The level already set needs no wish.
   */
  public suggest(levelId: string): void {
    if (levelId === this.levelId()) {
      return;
    }
    const word = this.word();
    this.say({ ...word, wish: word.wish === levelId ? null : levelId });
  }

  /** The guest says it is ready for the level set - or no longer is. */
  public toggleReady(): void {
    const word = this.word();
    this.say({
      ...word,
      readyFor: this.state().ready ? null : this.levelId(),
    });
  }

  private follow(event: OnlineEvent): void {
    switch (event.type) {
      case 'connected':
      case 'ended':
        this.word.set(NOTHING_SAID);
        this.heard.set(NOTHING_SAID);
        return;
      case 'room':
        this.heard.set(event.room);
        return;
      case 'setup':
        this.change(
          guestRoomAfter(this.word(), {
            type: 'setup',
            levelId: event.setup.levelId,
          })
        );
        return;
      case 'start':
        this.change(guestRoomAfter(this.word(), { type: 'start' }));
        return;
      case 'colors':
        return;
    }
  }

  /** The guest's own change - only where it can speak. */
  private say(word: GuestRoomState): void {
    if (this.online.lobby().role === 'guest' && this.available()) {
      this.change(word);
    }
  }

  /** Keeps the guest's word and tells the host, when it changed. */
  private change(word: GuestRoomState): void {
    if (sameWord(this.word(), word)) {
      return;
    }
    this.word.set(word);
    this.online.sendRoom(word);
  }

  /** The level of the next match, as this device's seat has it. */
  private levelId(): string | null {
    return this.store.online()?.levelId ?? null;
  }
}
