import { BOT_DIFFICULTIES } from './bot-controller';
import { CHAPTERS } from './chapters';
import {
  BUDGET_FACTOR,
  computerBudget,
  computerLoadout,
} from './computer-opponent';
import {
  GeneId,
  geneLevel,
  GENES,
  isPlainLoadout,
  Loadout,
  weaponOf,
} from './evolution';
import { geneCost } from './evolution-progress';
import { LADDER_VERSION, strengthOf } from './difficulty-curve';
import { expectedDna } from './expected-player';
import { generatedLevelId } from './level-generator/generate-level';
import { getLevel, LEVELS } from './levels';

function costOf(loadout: Loadout, free: boolean): number {
  const genes = GENES.reduce(
    (sum, { id }) => sum + geneCost(geneLevel(loadout, id)),
    0
  );
  return (
    genes +
    (loadout.weapon === null || free ? 0 : weaponOf(loadout.weapon).cost)
  );
}

function bredGenes(loadout: Loadout): GeneId[] {
  return GENES.map(({ id }) => id).filter((id) => geneLevel(loadout, id) > 0);
}

function chapterLevels(id: string): string[] {
  return CHAPTERS.find((chapter) => chapter.id === id)?.levelIds.slice() ?? [];
}

describe('the computer opponent', () => {
  it('stays plain on the Petri levels', () => {
    for (const levelId of chapterLevels('petri')) {
      for (const { id: difficulty } of BOT_DIFFICULTIES) {
        expect(computerLoadout(levelId, difficulty)).toEqual({
          genes: {},
          weapon: null,
        });
      }
    }
  });

  it('spends no more than its budget - a boss gets its weapon for free', () => {
    for (const { id: levelId, boss } of LEVELS) {
      for (const { id: difficulty } of BOT_DIFFICULTIES) {
        const loadout = computerLoadout(levelId, difficulty);
        expect(costOf(loadout, boss !== undefined)).toBeLessThanOrEqual(
          computerBudget(levelId, difficulty)
        );
      }
    }
  });

  it('follows the typical player DNA times the difficulty factor', () => {
    LEVELS.forEach(({ id }, index) => {
      for (const { id: difficulty } of BOT_DIFFICULTIES) {
        expect(computerBudget(id, difficulty)).toBe(
          Math.round(
            expectedDna(index) * BUDGET_FACTOR[difficulty] * strengthOf(id)
          )
        );
      }
    });
    expect(BUDGET_FACTOR.easy).toBeLessThan(BUDGET_FACTOR.normal);
    expect(BUDGET_FACTOR.normal).toBeLessThan(BUDGET_FACTOR.hard);
  });

  it('breeds by the chapter: mitosis and metabolism in the laboratory', () => {
    const loadout = computerLoadout('pistons', 'normal');

    expect(bredGenes(loadout)).toEqual(['mitosis', 'metabolism']);
    expect(loadout.weapon).toBeNull();
  });

  it('breeds mitosis and flagella in the body, toxins and membrane in the reactor', () => {
    expect(bredGenes(computerLoadout('alveoli', 'normal'))).toEqual([
      'mitosis',
      'flagella',
    ]);
    expect(bredGenes(computerLoadout('half-life', 'normal'))).toEqual([
      'toxins',
      'membrane',
    ]);
  });

  it('buys a weapon first in the outbreak and the expanse', () => {
    expect(computerLoadout('quarantine', 'easy').weapon).toBe('toxin-bomb');
    expect(computerLoadout('archipelago', 'normal').weapon).toBe('cryo-pulse');
  });

  it('gives a boss the most of everything and its own weapon', () => {
    for (const levelId of ['meltdown', 'patient-zero', 'leviathan']) {
      const loadout = computerLoadout(levelId, 'hard');
      expect(loadout.weapon).toBe(getLevel(levelId).boss?.weapon);
      expect(bredGenes(loadout)).toEqual(GENES.map(({ id }) => id));
    }
  });

  it('grows stronger with the difficulty', () => {
    for (const { id: levelId } of LEVELS.slice(3)) {
      const [easy, normal, hard] = BOT_DIFFICULTIES.map(({ id }) =>
        costOf(computerLoadout(levelId, id), false)
      );
      expect(easy).toBeLessThanOrEqual(normal);
      expect(normal).toBeLessThanOrEqual(hard);
    }
  });

  it('evolves on a generated level by its heat', () => {
    const calm = generatedLevelId({ recipe: 'field', seed: 9, difficulty: 1 });
    const warm = generatedLevelId({ recipe: 'field', seed: 9, difficulty: 4 });
    const hot = generatedLevelId({ recipe: 'field', seed: 9, difficulty: 10 });

    expect(isPlainLoadout(computerLoadout(calm, 'normal'))).toBe(true);
    expect(computerLoadout(warm, 'normal').weapon).toBeNull();
    expect(isPlainLoadout(computerLoadout(warm, 'normal'))).toBe(false);
    expect(computerLoadout(hot, 'normal').weapon).toBe('toxin-bomb');
  });

  it('stays plain on an id of no level', () => {
    expect(isPlainLoadout(computerLoadout('nowhere', 'hard'))).toBe(true);
  });

  it('gives every ladder level the loadouts its ladder version was taken with', () => {
    // A replay against the ladder's computer takes its loadout from here,
    // not from its header: a change that moves one - the budget, the
    // gene or weapon costs, a character - raises `LADDER_VERSION` and
    // takes the new fingerprint over.
    const table = JSON.stringify(
      LEVELS.flatMap(({ id: levelId }) =>
        BOT_DIFFICULTIES.map(({ id: difficulty }) =>
          computerLoadout(levelId, difficulty)
        )
      )
    );
    let hash = 0x811c9dc5;
    for (let i = 0; i < table.length; i++) {
      hash = Math.imul(hash ^ table.charCodeAt(i), 0x01000193) >>> 0;
    }

    expect(LADDER_VERSION).toBe(2);
    expect(`${table.length}:${hash.toString(16)}`).toBe('4747:9206f2e5');
  });
});
