import { LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import { MAX_GPU_COLONIES } from './simulation-shaders';

describe('simulation shaders', () => {
  it('has room on the GPU for the colonies of every level, neutral ones included', () => {
    for (const level of LEVELS) {
      expect(2 + (level.neutrals?.length ?? 0)).toBeLessThanOrEqual(
        MAX_GPU_COLONIES
      );
    }
  });
});
