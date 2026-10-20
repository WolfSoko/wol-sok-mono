import { randomSeed, streamSeed } from '../geometry';
import { GameBalance } from '../game-balance';
import type { Level } from '../levels';
import { GameMap, pointSymmetric, Rect } from '../maps';
import { MedalLimits } from '../medallions';
import { checkLayout, isPlayable } from './layout-check';
import { isRecipeId, Recipe, RECIPE_IDS, RecipeId, RECIPES } from './recipes';
import { Rng } from './rng';

/** The difficulties a generated level comes in, from calm to frantic. */
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;

/** Layouts tried per level, and valid ones compared, before falling back. */
const MAX_ATTEMPTS = 24;
const CANDIDATES = 5;
/** A detour this close to the recipe's is as good as it gets. */
const CLOSE_ENOUGH = 0.05;

/** What a generated level is made from - its id says it all. */
export interface LevelRecipe {
  recipe: RecipeId;
  seed: number;
  difficulty: number;
}

/**
 * The id of a generated level: `gen:<recipe>:<seed>:<difficulty>`. It is
 * stable for good - the same id is the same level on every device, so a
 * medallion, a replay or a link can name it. A change to the generator that
 * would lay out an old id differently needs a new recipe name instead.
 */
export function generatedLevelId({
  recipe,
  seed,
  difficulty,
}: LevelRecipe): string {
  return `gen:${recipe}:${seed >>> 0}:${difficulty}`;
}

/**
 * A new generated level of a style - any of them for 'any' - and a
 * difficulty, from a fresh seed.
 */
export function rollLevelId(
  style: RecipeId | 'any',
  difficulty: number,
  seed = randomSeed()
): string {
  return generatedLevelId({
    recipe: style === 'any' ? RECIPE_IDS[seed % RECIPE_IDS.length] : style,
    seed,
    difficulty,
  });
}

/** What a generated level's id is made from, null for any other id. */
export function parseGeneratedId(id: string): LevelRecipe | null {
  const match = /^gen:([a-z]+):(\d{1,10}):(\d{1,2})$/.exec(id);
  if (match == null || !isRecipeId(match[1])) {
    return null;
  }
  const seed = Number(match[2]);
  const difficulty = Number(match[3]);
  if (
    seed > 0xffffffff ||
    difficulty < MIN_DIFFICULTY ||
    difficulty > MAX_DIFFICULTY
  ) {
    return null;
  }
  const recipe: LevelRecipe = { recipe: match[1], seed, difficulty };
  // One level, one id: "gen:field:007:03" is not "gen:field:7:3".
  return generatedLevelId(recipe) === id ? recipe : null;
}

/** A generated level with everything it is played and dressed with. */
export interface GeneratedLevel {
  level: Level;
  /** The layout, on an arena of any size - not yet scaled to the grid. */
  map: GameMap;
  /** The hand-made level whose look and music it borrows. */
  family: string;
  /** Seed of its melody. */
  seed: number;
}

/**
 * The generated levels asked for lately. A daily or an endless run asks for
 * ever new ones, so the oldest are let go - generating one again is cheap.
 */
const generated = new Map<string, GeneratedLevel>();
const KEPT_LEVELS = 32;

/** The generated level with that id, null for any other id. */
export function generatedLevel(id: string): GeneratedLevel | null {
  const kept = generated.get(id);
  if (kept !== undefined) {
    return kept;
  }
  const recipe = parseGeneratedId(id);
  if (recipe === null) {
    return null;
  }
  const level = generate(recipe);
  generated.set(id, level);
  if (generated.size > KEPT_LEVELS) {
    generated.delete(generated.keys().next().value as string);
  }
  return level;
}

/** The first word of a generated name. */
const ADJECTIVES: readonly string[] = [
  'Quiet',
  'Rusty',
  'Hollow',
  'Bitter',
  'Silent',
  'Restless',
  'Pale',
  'Hungry',
  'Crooked',
  'Sunken',
  'Feral',
  'Glassy',
];

function generate(made: LevelRecipe): GeneratedLevel {
  const recipe = RECIPES[made.recipe];
  const id = generatedLevelId(made);
  const heat =
    (made.difficulty - MIN_DIFFICULTY) / (MAX_DIFFICULTY - MIN_DIFFICULTY);
  const rng = new Rng(streamSeed(made.seed, 1));
  const name = `${rng.pick(ADJECTIVES)} ${rng.pick(recipe.nouns)}`;
  const layouts = new Map<string, Rect[]>();
  const map: GameMap = {
    id,
    name,
    description: recipe.description,
    createWalls(width, height) {
      const key = `${width}x${height}`;
      let walls = layouts.get(key);
      if (walls === undefined) {
        walls = bestLayout(recipe, made.seed, width, height, heat);
        layouts.set(key, walls);
      }
      return walls.map((wall) => ({ ...wall }));
    },
  };
  return {
    level: {
      id,
      name,
      description: recipe.description,
      mapId: id,
      balance: balanceFor(heat),
      crosshairSpeed: Math.round(lerp(150, 220, heat)),
      medal: medalLimitsFor(heat),
    },
    map,
    family: rng.pick(recipe.family),
    // Mixed, so a low seed does not play a hand-made tune note for note.
    seed: streamSeed(made.seed, 3),
  };
}

/**
 * The most fitting of a few playable layouts the recipe makes from the seed:
 * each try draws from the next stream of the seed, so a level comes out the
 * same every time. When none is playable the arena stays open - never seen
 * in the tests, but nobody is ever kept waiting.
 */
function bestLayout(
  recipe: Recipe,
  seed: number,
  width: number,
  height: number,
  heat: number
): Rect[] {
  let best: { walls: Rect[]; miss: number } | null = null;
  let found = 0;
  for (
    let attempt = 0;
    attempt < MAX_ATTEMPTS && found < CANDIDATES;
    attempt++
  ) {
    const rng = new Rng(streamSeed(seed, attempt + 2));
    const walls = pointSymmetric(
      recipe.build(rng, width, height, heat),
      width,
      height
    );
    const report = checkLayout(walls, width, height);
    if (!isPlayable(report)) {
      continue;
    }
    found++;
    const miss = Math.abs(report.detour - recipe.detour);
    if (best === null || miss < best.miss) {
      best = { walls, miss };
    }
    if (miss < CLOSE_ENOUGH) {
      break;
    }
  }
  return best?.walls ?? [];
}

/**
 * The tuning of a generated level, between the calmest and the busiest of
 * the hand-made ones.
 */
function balanceFor(heat: number): Partial<GameBalance> {
  return {
    aggression: lerp(0.3, 0.95, heat),
    divideChancePerSec: lerp(2.6, 4.6, heat),
    nutrientCount: Math.round(lerp(5, 14, heat)),
    nutrientRespawnDelaySec: lerp(3, 1.2, heat),
  };
}

/**
 * Medallion limits like the ladder's: a busier level is over sooner, and
 * loses more of its colony on the way - gold asks for less of either.
 */
function medalLimitsFor(heat: number): MedalLimits {
  return {
    silverSec: Math.round(lerp(100, 50, heat)),
    goldSec: Math.round(lerp(65, 32, heat)),
    goldLossShare: Math.round(lerp(0.5, 1.2, heat) * 100) / 100,
  };
}

/** `heat` of the way from the calm value to the frantic one. */
function lerp(calm: number, frantic: number, heat: number): number {
  return calm + (frantic - calm) * heat;
}
