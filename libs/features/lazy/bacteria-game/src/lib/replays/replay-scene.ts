import { arenaContent, SeatColors } from '../arena/arena-content';
import type { ArenaContent, ArenaScene } from '../arena/arena-view.component';
import { type MatchLooks, matchLooks, seatLooks } from '../state/colony-looks';
import type { Rect } from '../state/maps';
import { getLevel, levelMap } from '../state/levels';
import type { MatchEngine } from '../state/match-engine';
import { replayEngine, type Replay } from '../state/replay';
import type { BacteriaLook } from '../state/skins';

/** How a replay is drawn: the device's look and its wish for less motion. */
export interface ReplayLook {
  look: BacteriaLook;
  reducedMotion: boolean;
}

/**
 * A recorded match as an `ArenaView` plays it by itself (ADR 0011): its
 * own `MatchEngine` from `replayEngine` - the humans played back from the
 * recording, the bot and the neutral colonies simulated again from the
 * seed, on the replay's ruleset - with nothing of the game's state, its
 * account or Firebase. The view calls {@link advance} with the ticks of
 * each frame and paints {@link content}.
 */
export class ReplayScene implements ArenaScene {
  private engine: MatchEngine;
  private readonly walls: readonly Rect[];
  /**
   * What the colonies wear: the computer plays in a match against it - a
   * recording is never a ghost race, and an online match is recorded as
   * one of two players.
   */
  private readonly looks: MatchLooks;
  private readonly seatColors = new SeatColors();
  private ended = false;

  /** Builds the scene - null for a replay that does not play back here. */
  public static of(replay: Replay, look: ReplayLook): ReplayScene | null {
    const engine = replayEngine(replay);
    return engine === null ? null : new ReplayScene(replay, look, engine);
  }

  private constructor(
    public readonly replay: Replay,
    private readonly look: ReplayLook,
    engine: MatchEngine
  ) {
    this.engine = engine;
    const { levelId, width, height } = replay.header;
    this.walls = levelMap(getLevel(levelId)).createWalls(width, height);
    this.looks = matchLooks(
      levelId,
      look.look,
      replay.header.mode === 'vs-computer'
    );
  }

  /** The ticks played so far. */
  public get tick(): number {
    return this.engine.tickCount;
  }

  /** True once the match played to its end - its outcome, or its last tick. */
  public get over(): boolean {
    return this.ended;
  }

  /** Plays up to `ticks` ticks of the match - none once it is over. */
  public advance(ticks: number): void {
    const { width, height, ticks: last } = this.replay.header;
    for (let played = 0; played < ticks && !this.ended; played++) {
      this.engine.tick(width, height);
      this.ended =
        this.engine.outcome() !== null || this.engine.tickCount >= last;
    }
  }

  /** The match from its first tick again. */
  public restart(): void {
    const engine = replayEngine(this.replay);
    if (engine === null) {
      return;
    }
    this.engine.dispose();
    this.engine = engine;
    this.ended = false;
  }

  public content(alpha: number): ArenaContent {
    const { engine } = this;
    const { width, height } = this.replay.header;
    return arenaContent({
      players: engine.players,
      crosshairAt: (player) => engine.crosshairAt(player, alpha, width, height),
      simulation: engine.simulation,
      walls: this.walls,
      // The level's balance at the replay's scale, as `planMatch` made it.
      balance: engine.balance,
      looks: seatLooks(engine.players, this.looks),
      reducedMotion: this.look.reducedMotion,
      weaponFires: engine.takeFrameEvents().weapons,
      seatColors: this.seatColors,
    });
  }

  /** Lets go of the engine - the view is done with the scene. */
  public dispose(): void {
    this.engine.dispose();
  }
}
