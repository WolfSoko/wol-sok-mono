import {
  INT_COLONIES,
  INT_MAX_EFFECTS,
  INT_PELLETS,
  INT_RECORD,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  LOSER_SHIFT,
  MAX_EFFECTS,
  MAX_GPU_COLONIES,
  MAX_PELLETS,
  POISONED,
  RECORD_MASK,
} from './simulation-shaders';

describe('integer simulation shaders', () => {
  it('take as many colonies, pellets and effects as the float ones', () => {
    expect(INT_COLONIES).toBe(MAX_GPU_COLONIES);
    expect(INT_PELLETS).toBe(MAX_PELLETS);
    expect(INT_MAX_EFFECTS).toBe(MAX_EFFECTS);
  });

  it('share the event record with the reference', () => {
    expect(INT_RECORD).toEqual({
      mask: RECORD_MASK,
      loserShift: LOSER_SHIFT,
      poisoned: POISONED,
    });
  });
});
