import { streamSeed } from './geometry';
import {
  generatedLevelId,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
} from './level-generator/generate-level';
import { RECIPE_IDS } from './level-generator/recipes';

/** Defeats an endless run survives - the last one ends it. */
export const ENDLESS_LIVES = 3;

/**
 * An endless run: generated levels one after the other, each win one step
 * harder, each defeat a life lost and the same level again.
 */
export interface EndlessRun {
  /** Where every level of the run comes from. */
  seed: number;
  /** Levels beaten so far - the depth of the run. */
  wins: number;
  lives: number;
}

export function newRun(seed: number): EndlessRun {
  return { seed, wins: 0, lives: ENDLESS_LIVES };
}

/**
 * The level the run is at: a style of its own for every depth, the
 * difficulty one step up with every win, up to the hardest.
 */
export function endlessLevelId({ seed, wins }: EndlessRun): string {
  return generatedLevelId({
    recipe: RECIPE_IDS[(seed + wins) % RECIPE_IDS.length],
    seed: streamSeed(seed, wins + 1),
    difficulty: Math.min(MAX_DIFFICULTY, MIN_DIFFICULTY + wins),
  });
}

/** The run after a match on its level, won or not. */
export function afterMatch(run: EndlessRun, won: boolean): EndlessRun {
  return won
    ? { ...run, wins: run.wins + 1 }
    : { ...run, lives: run.lives - 1 };
}

/** True once the run has no lives left. */
export function isRunOver(run: EndlessRun): boolean {
  return run.lives <= 0;
}
