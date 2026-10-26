import { ladderPosition } from './difficulty-curve';
import { getLevel } from './levels';
import type { Player } from './player.model';
import {
  type BacteriaLook,
  type BossLook,
  type ColonyLook,
  PREMIUM_SKINS,
} from './skins';
import { BOSS_SEAT } from './win-conditions';

/** The look a boss wears - see {@link BossLook}. */
export const BOSS_LOOK: BossLook = 'eclipse';

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
  return COMPUTER_LOOKS[Math.min(COMPUTER_LOOKS.length - 1, index)];
}

/** What the colonies of a match wear - see {@link seatLooks}. */
export interface MatchLooks {
  /** The skin the humans wear: the device's. */
  skin: BacteriaLook;
  /**
   * The look the computer wears on the match's level - null where no
   * computer plays, and every seat is a human's.
   */
  computer: BacteriaLook | null;
  /** True when the level's boss plays: it wears {@link BOSS_LOOK}. */
  boss: boolean;
}

/**
 * The looks of a match on a level: the humans in `skin`, and, where the
 * computer plays (`computer`: a match against it - not a ghost race, not
 * online, where the other seat spawns as a bot in a human's stead), the
 * computer as its level dresses it and the level's boss in its own.
 */
export function matchLooks(
  levelId: string,
  skin: BacteriaLook,
  computer: boolean
): MatchLooks {
  const level = getLevel(levelId);
  return {
    skin,
    computer: computer ? computerLook(levelId) : null,
    boss: computer && level.id === levelId && level.boss !== undefined,
  };
}

/**
 * The look of each seat's colony, in seat order: a human wears the skin,
 * the computer its level's look, the boss in its seat its own. The neutral
 * colonies behind the seats are no one's - see {@link NEUTRAL_LOOK}.
 */
export function seatLooks(
  players: readonly Player[],
  looks: MatchLooks
): ColonyLook[] {
  return players.map((player) =>
    !player.isBot || looks.computer === null
      ? looks.skin
      : looks.boss && player.id === BOSS_SEAT
        ? BOSS_LOOK
        : looks.computer
  );
}
