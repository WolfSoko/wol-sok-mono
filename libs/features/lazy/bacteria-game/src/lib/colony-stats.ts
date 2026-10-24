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
import { isObject } from './state/is-object';

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
  return humanAt(
    humans,
    BOOST_KEYS.indexOf(key === ' ' ? 'Space' : (key as BoostKey))
  );
}

/**
 * The human a key handed out in player order belongs to - the last human
 * takes the keys past the humans there are - null for no key (`index` -1).
 */
function humanAt(humans: readonly Player[], index: number): Player | null {
  if (index < 0 || humans.length === 0) {
    return null;
  }
  return humans[Math.min(index, humans.length - 1)];
}

/**
 * The keys that fire a weapon, next to each human's boost key, by the
 * human they are handed out to: E for the first (W A S D and Space), the
 * right Shift for the second (the arrow keys and Enter).
 */
const WEAPON_KEY_E = 0;
const WEAPON_KEY_SHIFT = 1;

/**
 * The human whose weapon a key fires, null for any other key - handed out
 * like the boost keys. Only the right Shift counts: the left one sits under
 * the first human's hand. `code` is the key's `KeyboardEvent.code`.
 *
 * Null as well when that human carries no weapon, so the key does what it
 * did before there were weapons - only a match against the computer on the
 * ladder or a generated level arms anyone.
 */
export function humanForWeaponKey(
  humans: readonly Player[],
  key: string,
  code: string
): Player | null {
  const human = humanAt(
    humans,
    key.toLowerCase() === 'e'
      ? WEAPON_KEY_E
      : key === 'Shift' && code === 'ShiftRight'
        ? WEAPON_KEY_SHIFT
        : -1
  );
  return human === null || human.weapon === null ? null : human;
}

/**
 * True when two scoreboards show the same - every field of every colony,
 * and of the objects in it, such as its weapon.
 */
export function sameColonyStats(
  a: readonly ColonyStats[],
  b: readonly ColonyStats[]
): boolean {
  return (
    a.length === b.length &&
    a.every((colony, index) => sameFields(colony, b[index]))
  );
}

/** True when two values are the same, or objects with the same fields. */
function sameFields(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (!isObject(a) || !isObject(b)) {
    return false;
  }
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => sameFields(a[key], b[key]))
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
  return {
    id: player.weapon,
    ready,
    active: player.weaponActiveSec > 0,
    cooldown: ready ? 0 : Math.ceil(player.weaponCooldownSec),
    charge: ready
      ? 1
      : chargeOf(player.weaponCooldownSec, player.weaponCooldownFullSec),
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
  return chargeOf(player.boostCooldownSec, full);
}

/**
 * How far a recharge of `fullSec` has come with `remainingSec` to go, 0..1
 * in hundredths - 1 for one that takes no time.
 */
function chargeOf(remainingSec: number, fullSec: number): number {
  return fullSec <= 0
    ? 1
    : clamp(Math.round((1 - remainingSec / fullSec) * 100) / 100, 0, 1);
}

/** What a boost button says: ready, running, or the seconds left to wait. */
export function boostLabel(colony: ColonyStats): string {
  if (colony.boostReady) {
    return 'Boost';
  }
  return colony.boosting ? 'Boosting' : `${colony.boostCooldown}s`;
}
