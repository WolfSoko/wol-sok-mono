import { Injectable } from '@angular/core';
import { FrameEvents } from './state/match-engine';
import { MatchResult } from './sound/game-sound.service';

/** A short buzz is skipped this close after the last one, in milliseconds. */
const BUZZ_INTERVAL_MS = 90;

/**
 * The game felt through the phone: a tap for a boost, a thud for a gate, a
 * flourish for a medallion - where the device can vibrate at all, and only
 * while the player wants it to.
 *
 * Everything goes through the Vibration API, which plays one pattern at a
 * time: a new call cuts the one before off. So a short buzz is dropped
 * while a longer pattern is still playing, and the frame events are rated -
 * a boost is felt, a pellet is not, or the phone would hum all match long.
 */
@Injectable({ providedIn: 'root' })
export class GameHapticsService {
  /** True where the browser can vibrate the device - an iPhone cannot. */
  public readonly supported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  private enabled = true;
  /** When the pattern that is playing ends, in ms of `performance.now()`. */
  private busyUntilMs = 0;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.supported) {
      // Whatever is still playing stops with the switch.
      this.busyUntilMs = 0;
      try {
        navigator.vibrate(0);
      } catch {
        // A browser that has the API but refuses it - in an iframe, say.
      }
    }
  }

  /** What a frame of the match is felt as: boosts, bursts and the gates. */
  public frame(events: FrameEvents): void {
    if (events.gatesClosed > 0) {
      this.pattern([70]);
    } else if (events.boosts.some((isBot) => !isBot)) {
      this.buzz(30);
    } else if (events.crushed > 0) {
      this.buzz(15);
    }
  }

  /** A short roll as the match starts. */
  public matchStart(): void {
    this.pattern([20, 50, 20, 50, 45]);
  }

  /** The end of the match, and a flourish on top for a medallion. */
  public matchEnd(result: MatchResult, medal = false): void {
    const base =
      result === 'win'
        ? [40, 60, 40, 60, 110]
        : result === 'loss'
          ? [160]
          : [50, 60, 50];
    this.pattern(medal ? [...base, 200, 25, 35, 25, 35, 25, 35, 90] : base);
  }

  /** A tap for a control - a switch, pause and resume. */
  public tap(): void {
    this.buzz(12);
  }

  /** A short buzz, unless one just played or a pattern still does. */
  private buzz(ms: number): void {
    const now = performance.now();
    if (!this.active() || now < this.busyUntilMs) {
      return;
    }
    this.busyUntilMs = now + ms + BUZZ_INTERVAL_MS;
    this.vibrate([ms]);
  }

  /** A pattern of buzzes and pauses, cutting off whatever plays. */
  private pattern(pattern: number[]): void {
    if (!this.active()) {
      return;
    }
    this.busyUntilMs =
      performance.now() + pattern.reduce((sum, ms) => sum + ms, 0);
    this.vibrate(pattern);
  }

  private active(): boolean {
    return this.supported && this.enabled;
  }

  private vibrate(pattern: number[]): void {
    try {
      navigator.vibrate(pattern);
    } catch {
      // A browser that has the API but refuses it - in an iframe, say.
    }
  }
}
