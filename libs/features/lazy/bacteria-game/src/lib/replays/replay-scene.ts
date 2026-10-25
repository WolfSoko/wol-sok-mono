import type { ArenaContent, ArenaScene } from '../arena/arena-view.component';
import { particleBudget } from '../arena/weapon-fx';
import { DEFAULT_SCREEN_RESOLUTION } from '../state/arena-size';
import type { GameBalance } from '../state/game-balance';
import { Rect } from '../state/maps';
import { getLevel, gridScale, levelBalance, levelMap } from '../state/levels';
import type { MatchEngine } from '../state/match-engine';
import { isBoosted, Player } from '../state/player.model';
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
  private readonly balance: GameBalance;
  private readonly walls: readonly Rect[];
  private seatColors = new Map<number, readonly number[]>();
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
    const level = getLevel(levelId);
    this.balance = levelBalance(level, gridScale(level, width));
    this.walls = levelMap(level).createWalls(width, height);
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
    const { engine, balance } = this;
    const { width, height } = this.replay.header;
    const players = engine.players;
    const drawn = players.map((player) => ({
      player,
      at: engine.crosshairAt(player, alpha, width, height),
    }));
    const boosts = new Map(
      drawn
        .filter(({ player }) => isBoosted(player))
        .map(({ player, at }) => [player.id, at])
    );
    const { simulation } = engine;
    return {
      walls: this.walls,
      dynamicWalls: simulation.getDynamicWalls(),
      colonies: simulation.colonyLayers(boosts),
      reducedMotion: this.look.reducedMotion,
      nutrients: simulation.getNutrients(),
      balance,
      look: this.look.look,
      cursors: drawn.map(({ player, at }) => ({
        ...at,
        color: player.color,
        boostLeft:
          isBoosted(player) && balance.boostDurationSec > 0
            ? player.boostActiveSec / balance.boostDurationSec
            : null,
      })),
      weaponFires: engine.takeFrameEvents().weapons,
      weaponEffects: simulation.getActiveEffects(),
      seatColors: this.colorsOf(players),
      particleBudget: particleBudget(
        DEFAULT_SCREEN_RESOLUTION,
        this.look.reducedMotion
      ),
    };
  }

  /** Lets go of the engine - the view is done with the scene. */
  public dispose(): void {
    this.engine.dispose();
  }

  /** The seats' colours - the same map until one of them changes. */
  private colorsOf(
    players: readonly Player[]
  ): ReadonlyMap<number, readonly number[]> {
    const known = this.seatColors;
    if (
      known.size !== players.length ||
      players.some((player) => known.get(player.id) !== player.color)
    ) {
      this.seatColors = new Map(
        players.map((player) => [player.id, player.color])
      );
    }
    return this.seatColors;
  }
}
