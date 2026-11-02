/**
 * @jest-environment node
 */
import { BALANCE_VERSION } from '../src/engine';
import golden from './golden-gpu-int.json';
import { referenceHashes, SCENARIOS } from './scenarios';

/**
 * The golden hashes of the GPU cross-check (`gpu-int.crosscheck.ts`) are
 * the TypeScript reference's: a change to the integer passes or the balance
 * shows up here first, without a browser. Regenerate them by writing what
 * `referenceHashes` returns; a change to what the passes compute also
 * bumps `BALANCE_VERSION`, a change to the scenarios does not.
 */
describe('the golden hashes of the GPU cross-check', () => {
  it('belong to this balance version', () => {
    expect(golden.balanceVersion).toBe(BALANCE_VERSION);
    expect(Object.keys(golden.hashes).sort()).toEqual(
      Object.keys(SCENARIOS).sort()
    );
  });

  it.each(Object.keys(SCENARIOS))('are the reference hashes of %s', (name) => {
    expect(referenceHashes(SCENARIOS[name]())).toEqual(
      golden.hashes[name as keyof typeof golden.hashes]
    );
  });
});
