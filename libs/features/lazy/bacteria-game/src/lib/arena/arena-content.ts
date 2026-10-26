import {
  DEFAULT_SCREEN_RESOLUTION,
  type ScreenResolution,
} from '../state/arena-size';
import type { WeaponFire } from '../state/evolution';
import type { GameBalance } from '../state/game-balance';
import type { Point } from '../state/geometry';
import type { Rect } from '../state/maps';
import { isBoosted, type Player } from '../state/player.model';
import type { Simulation } from '../state/simulation';
import { NEUTRAL_LOOK } from '../state/colony-looks';
import type { ColonyLook } from '../state/skins';
import type { ArenaContent } from './arena-view.component';
import { particleBudget } from './weapon-fx';

/** What a frame of a match is drawn from - the game's or a replay's. */
export interface ArenaSource {
  players: readonly Player[];
  /** Where a player's crosshair stands in this frame. */
  crosshairAt(player: Player): Point;
  simulation: Simulation;
  walls: readonly Rect[];
  balance: GameBalance;
  /**
   * The look of each seat's colony, in seat order (`seatLooks`). The
   * colonies behind the seats are the neutral ones, in {@link NEUTRAL_LOOK}.
   */
  looks: readonly ColonyLook[];
  reducedMotion: boolean;
  /** The weapons fired since the frame before. */
  weaponFires: readonly WeaponFire[];
  seatColors: SeatColors;
  /** What the weapons' particles are budgeted for - the default without. */
  screenResolution?: ScreenResolution;
}

/** What the arena shows of a match in a frame, for the painter. */
export function arenaContent(source: ArenaSource): ArenaContent {
  const { players, simulation, balance, reducedMotion } = source;
  const drawn = players.map((player) => ({
    player,
    at: source.crosshairAt(player),
  }));
  const boosts = new Map(
    drawn
      .filter(({ player }) => isBoosted(player))
      .map(({ player, at }) => [player.id, at])
  );
  return {
    walls: source.walls,
    dynamicWalls: simulation.getDynamicWalls(),
    colonies: simulation.colonyLayers(boosts).map((layer, seat) => ({
      ...layer,
      look: source.looks[seat] ?? NEUTRAL_LOOK,
    })),
    reducedMotion,
    nutrients: simulation.getNutrients(),
    balance,
    cursors: drawn.map(({ player, at }) => ({
      ...at,
      color: player.color,
      boostLeft:
        isBoosted(player) && balance.boostDurationSec > 0
          ? player.boostActiveSec / balance.boostDurationSec
          : null,
    })),
    weaponFires: source.weaponFires,
    weaponEffects: simulation.getActiveEffects(),
    seatColors: source.seatColors.of(players),
    particleBudget: particleBudget(
      source.screenResolution ?? DEFAULT_SCREEN_RESOLUTION,
      reducedMotion
    ),
  };
}

/**
 * The seats' colours for the painter: a match keeps its colours, so the
 * map of the frame before is handed on until one of them is another.
 */
export class SeatColors {
  private colors = new Map<number, readonly number[]>();

  public of(
    players: readonly Player[]
  ): ReadonlyMap<number, readonly number[]> {
    const known = this.colors;
    if (
      known.size !== players.length ||
      players.some((player) => known.get(player.id) !== player.color)
    ) {
      this.colors = new Map(players.map((player) => [player.id, player.color]));
    }
    return this.colors;
  }
}
