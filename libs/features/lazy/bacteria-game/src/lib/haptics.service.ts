import { Injectable, inject } from '@angular/core';
import { GameSettingsService } from './settings.service';
import { FrameEvents, MatchResult } from './state/match-engine';

/** A short buzz is skipped this close after the last one, in milliseconds. */
const BUZZ_INTERVAL_MS = 90;

/**
 * The game felt through the phone: a tap for a boost, a thud for a gate, a
 * flourish for a medallion - where the device can vibrate at all, and only
 * while the vibration setting is on.
 *
 * Everything goes through the Vibration API, which plays one pattern at a
 * time: a new call cuts the one before off. So a short buzz is dropped
 * while a longer pattern is still playing, and the frame events are rated -
 * a boost is felt, a pellet is not, or the phone would hum all match long.
 */
@Injectable({ providedIn: 'root' })
export class GameHapticsService {
  private readonly settings = inject(GameSettingsService);
  /** True where the browser can vibrate the device - an iPhone cannot. */
  public readonly supported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  /** When the pattern that is playing ends, in ms of `performance.now()`. */
  private busyUntilMs = 0;

  /** Stops whatever is still playing - for the setting switched off. */
  public stop(): void {
    if (this.supported) {
      this.busyUntilMs = 0;
      this.vibrate(0);
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

  /**
   * An Evolution purchase landing: a quick double kick, and a long roll on
   * top for a gene bred to the top.
   */
  public evolve(maxed = false): void {
    this.pattern(maxed ? [30, 40, 30, 40, 160] : [25, 45, 60]);
  }

  /** A short buzz, unless one just played or a pattern still does. */
  private buzz(ms: number): void {
    if (performance.now() < this.busyUntilMs) {
      return;
    }
    this.pattern([ms], BUZZ_INTERVAL_MS);
  }

  /**
   * A pattern of buzzes and pauses, cutting off whatever plays, and holding
   * short buzzes off until it and `gapMs` more have passed.
   */
  private pattern(pattern: number[], gapMs = 0): void {
    if (!this.supported || !this.settings.vibration()) {
      return;
    }
    this.busyUntilMs =
      performance.now() + pattern.reduce((sum, ms) => sum + ms, gapMs);
    this.vibrate(pattern);
  }

  private vibrate(pattern: number | number[]): void {
    try {
      navigator.vibrate(pattern);
    } catch {
      // A browser that has the API but refuses it - in an iframe, say.
    }
  }
}
