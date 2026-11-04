import { ladderPosition } from './difficulty-curve';
import { clamp } from './geometry';
import type { Player } from './player.model';
import {
  type BacteriaLook,
  BOSS_LOOK,
  type ColonyLook,
  PREMIUM_SKINS,
} from './skins';

/** The look of a neutral colony: nobody's, so plain. */
export const NEUTRAL_LOOK: ColonyLook = 'slime';

/**
 * The looks the computer climbs through along the ladder: the plain slime
 * first, then every skin to buy in the gallery's order - the order of
 * their prices, so the computer's dress tells how far it has come.
 */
const COMPUTER_LOOKS: readonly BacteriaLook[] = [
  'slime',
  ...PREMIUM_SKINS.map(({ id }) => id),
];

/**
 * The skin the computer wears on a level: the further up the ladder, the
 * finer - the same place that sets its skill (`ladderPosition`), so a
 * generated level dresses it by its heat. Slime on a level of neither
 * kind.
 */
export function computerLook(levelId: string): BacteriaLook {
  const position = ladderPosition(levelId) ?? 0;
  const index = Math.floor(position * COMPUTER_LOOKS.length);
  return COMPUTER_LOOKS[clamp(index, 0, COMPUTER_LOOKS.length - 1)];
}

/**
 * The look of each seat's colony, in seat order, from what the match made
 * of the seat (`Player.boss`, `Player.computer`): the boss wears
 * {@link BOSS_LOOK}, whoever steers it, the computer its level's look,
 * `computer`, and every other seat `skin` - the humans, and a seat a
 * recording drives for one.
 * The neutral colonies behind the seats are no one's - see
 * {@link NEUTRAL_LOOK}.
 */
export function seatLooks(
  players: readonly Player[],
  skin: BacteriaLook,
  computer: BacteriaLook
): ColonyLook[] {
  return players.map((player) =>
    player.boss ? BOSS_LOOK : player.computer ? computer : skin
  );
}
