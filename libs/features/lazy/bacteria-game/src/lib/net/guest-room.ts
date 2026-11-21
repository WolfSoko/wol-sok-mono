import { computed, inject, Injectable, signal } from '@angular/core';
import { GameStateStore } from '../state/game.states';
import type { GuestRoomState } from './net-message';
import { type OnlineEvent, OnlineMatchService } from './online-match.service';

/**
 * The guest's word in the room as the guest keeps it: its wish, and the
 * level it said ready for - ready holds only while that level is set.
 */
export interface GuestWish {
  wish: string | null;
  readyFor: string | null;
}

export const NO_WISH: GuestWish = { wish: null, readyFor: null };

const NOTHING_SAID: GuestRoomState = { wish: null, ready: false };

/**
 * The guest's word after the host set `levelId` up: a wish the host took
 * is fulfilled, and ready for another level no longer holds.
 */
export function afterSetup(word: GuestWish, levelId: string): GuestWish {
  return {
    wish: word.wish === levelId ? null : word.wish,
    readyFor: word.readyFor === levelId ? word.readyFor : null,
  };
}

/** The guest's word once a match started: ready was for that match. */
export function afterStart(word: GuestWish): GuestWish {
  return { ...word, readyFor: null };
}

/** What the guest's word says over the wire. */
function said({ wish, readyFor }: GuestWish): GuestRoomState {
  return { wish, ready: readyFor !== null };
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
  private readonly word = signal<GuestWish>(NO_WISH);
  /** What the guest told the host, at the host. */
  private readonly heard = signal<GuestRoomState>(NOTHING_SAID);

  /** True where the guest can speak: connected to a peer that understands the room. */
  public readonly available = computed(
    () =>
      this.online.lobby().phase === 'connected' &&
      this.online.peerFeatures().includes('room')
  );

  /** The guest's wish and ready, on either seat. */
  public readonly state = computed((): GuestRoomState =>
    this.online.lobby().role === 'guest' ? said(this.word()) : this.heard()
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
    const { wish } = this.word();
    this.say({ ...this.word(), wish: wish === levelId ? null : levelId });
  }

  /** The guest says it is ready for the level set - or no longer is. */
  public toggleReady(): void {
    const word = this.word();
    this.say({
      ...word,
      readyFor: word.readyFor === null ? this.levelId() : null,
    });
  }

  private follow(event: OnlineEvent): void {
    switch (event.type) {
      case 'connected':
      case 'ended':
        this.word.set(NO_WISH);
        this.heard.set(NOTHING_SAID);
        return;
      case 'room':
        this.heard.set(event.room);
        return;
      case 'setup':
        this.change(afterSetup(this.word(), event.setup.levelId));
        return;
      case 'start':
        this.change(afterStart(this.word()));
        return;
      case 'colors':
        return;
    }
  }

  /** The guest's own change - only where it can speak. */
  private say(word: GuestWish): void {
    if (this.online.lobby().role === 'guest' && this.available()) {
      this.change(word);
    }
  }

  /** Keeps the guest's word and tells the host, when it changed. */
  private change(word: GuestWish): void {
    const before = this.word();
    if (before.wish === word.wish && before.readyFor === word.readyFor) {
      return;
    }
    this.word.set(word);
    this.online.sendRoom(said(word));
  }

  private levelId(): string | null {
    return this.store.online()?.levelId ?? null;
  }
}
