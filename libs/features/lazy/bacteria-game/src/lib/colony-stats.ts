import { GameBalance, gameBalance } from './state/game-balance';
import { clamp } from './state/geometry';
import { isBoostReady, Player } from './state/player.model';

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
  /** Whole seconds until the boost can be fired again, 0 when it is ready. */
  boostCooldown: number;
  /** How far the boost has recharged, 0..1 - the ring around the touch button. */
  boostCharge: number;
  /** The key that fires the boost, for the button label. */
  boostKey: BoostKey;
}

/** The keys that fire a boost: Space for the first human, Enter for the second. */
export type BoostKey = 'Space' | 'Enter';
const BOOST_KEYS: readonly BoostKey[] = ['Space', 'Enter'];

/**
 * The boost key of a human player: the keys are handed out in player order.
 * With a single human both keys belong to that player, so the label shows the
 * primary one.
 */
export function boostKeyOf(
  humans: readonly Player[],
  player: Player
): BoostKey {
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
    boosting: player.boostActiveSec > 0,
    boostCooldown: isBoostReady(player)
      ? 0
      : Math.ceil(player.boostCooldownSec),
    boostCharge: boostChargeOf(player, balance),
    boostKey: boostKeyOf(humans, player),
  }));
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
  if (player.boostActiveSec > 0 || balance.boostCooldownSec <= 0) {
    return 0;
  }
  const charge = 1 - player.boostCooldownSec / balance.boostCooldownSec;
  return clamp(Math.round(charge * 100) / 100, 0, 1);
}

/** What a boost button says: ready, running, or the seconds left to wait. */
export function boostLabel(colony: ColonyStats): string {
  if (colony.boosting) {
    return 'Boosting';
  }
  return colony.boostCooldown > 0 ? `${colony.boostCooldown}s` : 'Boost';
}
