import { streamSeed } from '../geometry';
import { GameBalance } from '../game-balance';
import type { Level } from '../levels';
import { GameMap, pointSymmetric, Rect } from '../maps';
import { MedalLimits } from '../medallions';
import { checkLayout, isPlayable } from './layout-check';
import { isRecipeId, Recipe, RecipeId, RECIPES } from './recipes';
import { Rng } from './rng';

/** The difficulties a generated level comes in, from calm to frantic. */
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;

/** Layouts tried per level, and valid ones compared, before falling back. */
const MAX_ATTEMPTS = 24;
const CANDIDATES = 5;

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
  return { recipe: match[1], seed, difficulty };
}

/** A generated level with everything it is played and dressed with. */
export interface GeneratedLevel {
  level: Level;
  /** The layout, on an arena of any size - not yet scaled to the grid. */
  map: GameMap;
  /** The hand-made level whose look and music it borrows. */
  family: string;
  /** Seed of its tune and of the look borrowed from the family. */
  seed: number;
}

const generated = new Map<string, GeneratedLevel | null>();

/** The generated level with that id, null for any other id. */
export function generatedLevel(id: string): GeneratedLevel | null {
  if (!generated.has(id)) {
    const recipe = parseGeneratedId(id);
    generated.set(id, recipe === null ? null : generate(recipe));
  }
  return generated.get(id) ?? null;
}

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
      crosshairSpeed: Math.round(150 + heat * 60),
      medal: medalLimitsFor(heat),
    },
    map,
    family: rng.pick(recipe.family),
    seed: made.seed,
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
    if (!isPlayable(report) || report.detour === null) {
      continue;
    }
    found++;
    const miss = Math.abs(report.detour - recipe.detour);
    if (best === null || miss < best.miss) {
      best = { walls, miss };
    }
  }
  return best?.walls ?? [];
}

/**
 * The tuning of a generated level, between the calmest and the busiest of
 * the hand-made ones.
 */
function balanceFor(heat: number): Partial<GameBalance> {
  const lerp = (calm: number, frantic: number) =>
    calm + (frantic - calm) * heat;
  return {
    aggression: lerp(0.3, 0.75),
    divideChancePerSec: lerp(2.6, 3.6),
    nutrientCount: Math.round(lerp(5, 14)),
    nutrientRespawnDelaySec: lerp(3, 1.2),
  };
}

/** Medallion limits that tighten with the difficulty, like the ladder's. */
function medalLimitsFor(heat: number): MedalLimits {
  return {
    silverSec: Math.round(100 - heat * 50),
    goldSec: Math.round(65 - heat * 33),
    goldLossShare: Math.round((0.6 - heat * 0.2) * 100) / 100,
  };
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
