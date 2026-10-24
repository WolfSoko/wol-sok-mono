import { BotDifficulty } from './bot-controller';
import { ChapterId, CHAPTERS } from './chapters';
import { ladderPosition, strengthOf } from './difficulty-curve';
import { GeneId, GENES, Loadout, PLAIN_LOADOUT, WeaponId } from './evolution';
import { expectedDna, Purchase, spend } from './expected-player';
import { getLevel, LEVELS } from './levels';

/**
 * The computer's evolution (ADR 0014): what it brings into a match against
 * it on the ladder or a generated level. Fixed per level and difficulty,
 * never adapted to the player's DNA - copying it would cancel every
 * purchase - and deterministic, so a replay's header keeps it like the
 * player's.
 *
 * The budget follows the DNA a typical player holds at that point of the
 * ladder (`expected-player.ts`), times a factor per difficulty and the
 * level's calibrated `STRENGTH`, and the chapter's character decides how
 * it is spent.
 */

/** Times the typical player's DNA the computer gets, by difficulty. */
export const BUDGET_FACTOR: Readonly<Record<BotDifficulty, number>> = {
  easy: 0.5,
  normal: 1,
  hard: 1.5,
};

/** How a chapter's computer spends its DNA. */
interface Character {
  /** The genes it breeds first, in turn - the others with what is left. */
  genes: readonly GeneId[];
  /**
   * The weapon it buys first, before any gene - none for a chapter whose
   * computer fights with its genes alone.
   */
  weapon: WeaponId | null;
}

const ALL_GENES: readonly GeneId[] = GENES.map(({ id }) => id);

/** Each chapter's character - see the ADR. */
const CHARACTERS: Readonly<Record<ChapterId, Character | null>> = {
  // Nothing on the first levels: the player learns the game.
  petri: null,
  laboratory: { genes: ['mitosis', 'metabolism'], weapon: null },
  // Many and fast.
  body: { genes: ['mitosis', 'flagella'], weapon: null },
  reactor: { genes: ['toxins', 'membrane'], weapon: null },
  // Weapons first.
  outbreak: { genes: ALL_GENES, weapon: 'toxin-bomb' },
  expanse: { genes: ALL_GENES, weapon: 'cryo-pulse' },
};

/**
 * A generated level's computer: weapons first on a hot level, genes alone
 * on a calm one.
 */
const GENERATED_CALM: Character = { genes: ALL_GENES, weapon: null };
const GENERATED_HOT: Character = { genes: ALL_GENES, weapon: 'toxin-bomb' };
/** From this heat on a generated level's computer carries a weapon. */
const HOT_FROM = 0.5;

/** The chapter a ladder level belongs to, null for any other id. */
function chapterOf(levelId: string): ChapterId | null {
  return (
    CHAPTERS.find((chapter) => chapter.levelIds.includes(levelId))?.id ?? null
  );
}

/** The DNA the computer spends on a level and difficulty. */
export function computerBudget(
  levelId: string,
  difficulty: BotDifficulty
): number {
  const position = ladderPosition(levelId);
  if (position === null) {
    return 0;
  }
  const dna = expectedDna(position * (LEVELS.length - 1));
  return Math.round(dna * BUDGET_FACTOR[difficulty] * strengthOf(levelId));
}

/**
 * What the computer brings into a match against it on a level and
 * difficulty: its budget spent by the chapter's character. A boss spends
 * it on everything and carries its own weapon besides, which costs it
 * nothing. Plain on the Petri levels and on an id of no level.
 */
export function computerLoadout(
  levelId: string,
  difficulty: BotDifficulty
): Loadout {
  const budget = computerBudget(levelId, difficulty);
  const level = getLevel(levelId);
  const boss = level.id === levelId ? level.boss : undefined;
  if (boss !== undefined) {
    return {
      genes: spend(budget, genePurchases(ALL_GENES)).genes,
      weapon: boss.weapon ?? null,
    };
  }
  const character = characterOf(levelId);
  if (character === null || budget === 0) {
    return PLAIN_LOADOUT;
  }
  const weapon: Purchase[] =
    character.weapon === null ? [] : [{ weapon: character.weapon }];
  return spend(budget, [...weapon, ...genePurchases(character.genes)]);
}

/** A level's character - by its chapter, or a generated level's by its heat. */
function characterOf(levelId: string): Character | null {
  const chapter = chapterOf(levelId);
  if (chapter !== null) {
    return CHARACTERS[chapter];
  }
  const heat = ladderPosition(levelId);
  return heat === null
    ? null
    : heat >= HOT_FROM
      ? GENERATED_HOT
      : GENERATED_CALM;
}

/**
 * The genes' levels in the order they are bred: the favourite genes in
 * turn to the top, then the others in turn.
 */
function genePurchases(favourites: readonly GeneId[]): Purchase[] {
  const others = ALL_GENES.filter((gene) => !favourites.includes(gene));
  const levels = (genes: readonly GeneId[]): Purchase[] =>
    [1, 2, 3, 4, 5].flatMap(() => genes.map((gene) => ({ gene })));
  return [...levels(favourites), ...levels(others)];
}
