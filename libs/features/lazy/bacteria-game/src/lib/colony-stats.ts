import { GameBalance, gameBalance } from './state/game-balance';
import { TICKS_PER_SEC } from './state/fixed-tick';
import { clamp } from './state/geometry';
import {
  isBoosted,
  isBoostReady,
  isWeaponReady,
  Player,
} from './state/player.model';
import type { WeaponId } from './state/evolution';

/** Statistics of one colony, ready to be rendered by the template. */
export interface ColonyStats {
  id: number;
  name: string;
  isBot: boolean;
  css: string;
  bacterias: number;
  captured: number;
  lost: number;
  /** Average energy in percent of the normal maximum. */
  energy: number;
  /** Share of all living bacteria in percent. */
  share: number;
  /** True while the boost of this colony is running. */
  boosting: boolean;
  /** True when the boost can be fired right now. */
  boostReady: boolean;
  /** Whole seconds until the boost can be fired again, 0 when it is ready. */
  boostCooldown: number;
  /** How far the boost has recharged, 0..1 - the ring around the touch button. */
  boostCharge: number;
  /** The key that fires the boost, for the button label. */
  boostKey: BoostKey;
  /** Whole seconds the colony held the hold zone. */
  held: number;
  /** Pellets the colony ate up. */
  pellets: number;
  /** The weapon the colony carries and how it stands, null for none. */
  weapon: WeaponStats | null;
}

/** A colony's weapon, ready to be rendered by its button. */
export interface WeaponStats {
  id: WeaponId;
  /** True when it can be fired right now. */
  ready: boolean;
  /** True while its effect acts on the war. */
  active: boolean;
  /** Whole seconds until it can be fired again, 0 when it is ready. */
  cooldown: number;
  /** How far it has recharged, 0..1, in hundredths - the ring round the button. */
  charge: number;
}

/** The keys that fire a boost: Space for the first human, Enter for the second. */
export type BoostKey = 'Space' | 'Enter';
const BOOST_KEYS: readonly BoostKey[] = ['Space', 'Enter'];

/**
 * The boost key of a human player: the keys are handed out in player order.
 * With a single human both keys belong to that player, so the label shows the
 * primary one.
 */
function boostKeyOf(humans: readonly Player[], player: Player): BoostKey {
  return BOOST_KEYS[clamp(humans.indexOf(player), 0, BOOST_KEYS.length - 1)];
}

/**
 * The human whose boost a key fires, null for any other key. Each key goes to
 * the human it is handed out to; with fewer humans than keys the last human
 * takes the rest, so against the computer Enter works as well as Space.
 */
export function humanForBoostKey(
  humans: readonly Player[],
  key: string
): Player | null {
  const index = BOOST_KEYS.indexOf(key === ' ' ? 'Space' : (key as BoostKey));
  if (index < 0 || humans.length === 0) {
    return null;
  }
  return humans[Math.min(index, humans.length - 1)];
}

/** True when two scoreboards show the same - every field of every colony. */
export function sameColonyStats(
  a: readonly ColonyStats[],
  b: readonly ColonyStats[]
): boolean {
  return (
    a.length === b.length &&
    a.every((colony, index) => {
      const other = b[index];
      return (Object.keys(colony) as (keyof ColonyStats)[]).every((key) =>
        key === 'weapon'
          ? sameWeaponStats(colony.weapon, other.weapon)
          : colony[key] === other[key]
      );
    })
  );
}

function sameWeaponStats(
  a: WeaponStats | null,
  b: WeaponStats | null
): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.id === b.id &&
      a.ready === b.ready &&
      a.active === b.active &&
      a.cooldown === b.cooldown &&
      a.charge === b.charge)
  );
}

/** Turns the stored players into the numbers the scoreboard renders. */
export function toColonyStats(
  players: Player[],
  balance: GameBalance = gameBalance
): ColonyStats[] {
  const total = players.reduce((sum, player) => sum + player.bacteriaCount, 0);
  const humans = players.filter((player) => !player.isBot);
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    isBot: player.isBot,
    css: `rgba(${player.color.join(',')})`,
    bacterias: player.bacteriaCount,
    captured: player.captured,
    lost: player.lost,
    energy: Math.round((player.averageEnergy / balance.maxEnergy) * 100),
    // Whole percent: the bar would move every frame otherwise, invisibly.
    share: total > 0 ? Math.round((player.bacteriaCount / total) * 100) : 0,
    boosting: isBoosted(player),
    boostReady: isBoostReady(player),
    boostCooldown: isBoostReady(player)
      ? 0
      : Math.ceil(player.boostCooldownSec),
    boostCharge: boostChargeOf(player, balance),
    boostKey: boostKeyOf(humans, player),
    held: Math.floor(player.holdTicks / TICKS_PER_SEC),
    pellets: player.pellets,
    weapon: weaponStatsOf(player),
  }));
}

/**
 * Where a colony's weapon stands, null without one. Its charge counts in
 * hundredths, like the boost's, so the ring is not redrawn every frame.
 */
export function weaponStatsOf(player: Player): WeaponStats | null {
  if (player.weapon == null) {
    return null;
  }
  const ready = isWeaponReady(player);
  const full = player.weaponCooldownFullSec;
  const charge =
    ready || full <= 0
      ? 1
      : clamp(
          Math.round((1 - player.weaponCooldownSec / full) * 100) / 100,
          0,
          1
        );
  return {
    id: player.weapon,
    ready,
    active: player.weaponActiveSec > 0,
    cooldown: ready ? 0 : Math.ceil(player.weaponCooldownSec),
    charge: ready ? 1 : charge,
  };
}

/**
 * How far the boost has recharged, 1 while it is ready. A running boost still
 * reads as empty: its cooldown has not started counting yet. In hundredths,
 * so the ring around the button is redrawn a hundred times per cooldown
 * rather than every frame.
 */
function boostChargeOf(player: Player, balance: GameBalance): number {
  if (isBoostReady(player)) {
    return 1;
  }
  // The cooldown the boost started - a boss's is shorter than the balance's.
  const full = player.boostCooldownFullSec || balance.boostCooldownSec;
  if (player.boostActiveSec > 0 || full <= 0) {
    return 0;
  }
  const charge = 1 - player.boostCooldownSec / full;
  return clamp(Math.round(charge * 100) / 100, 0, 1);
}

/** What a boost button says: ready, running, or the seconds left to wait. */
export function boostLabel(colony: ColonyStats): string {
  if (colony.boostReady) {
    return 'Boost';
  }
  return colony.boosting ? 'Boosting' : `${colony.boostCooldown}s`;
}
