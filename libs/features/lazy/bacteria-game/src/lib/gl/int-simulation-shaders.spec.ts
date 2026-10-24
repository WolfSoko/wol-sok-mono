import { INT_COLONIES, INT_PELLETS } from '../state/gpu-int/int-frame-uniforms';
import { INT_RECORD } from '../state/gpu-int/int-reference';
import {
  LOSER_SHIFT,
  MAX_GPU_COLONIES,
  MAX_PELLETS,
  POISONED,
  RECORD_MASK,
} from './simulation-shaders';

describe('integer simulation shaders', () => {
  it('take as many colonies and pellets as the float ones', () => {
    expect(INT_COLONIES).toBe(MAX_GPU_COLONIES);
    expect(INT_PELLETS).toBe(MAX_PELLETS);
  });

  it('share the event record with the reference', () => {
    expect(INT_RECORD).toEqual({
      mask: RECORD_MASK,
      loserShift: LOSER_SHIFT,
      poisoned: POISONED,
    });
  });
});
