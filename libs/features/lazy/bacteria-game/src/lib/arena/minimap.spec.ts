import { BlockCounts } from '../state/simulation';
import { minimapPixels } from './minimap';

const RED = [255, 0, 0];
const BLUE = [0, 0, 255];

/** Two blocks of 2x2 cells side by side. */
function blocks(...counts: number[][]): BlockCounts {
  return {
    blocksX: 2,
    blocksY: 1,
    cellSize: 2,
    counts: counts.map((colony) => Uint32Array.from(colony)),
  };
}

describe('minimapPixels', () => {
  it('colours a block after the colony with the most bacteria in it', () => {
    const pixels = minimapPixels(blocks([3, 1], [1, 4]), [RED, BLUE]);

    expect(Array.from(pixels.slice(0, 3))).toEqual(RED);
    expect(Array.from(pixels.slice(4, 7))).toEqual(BLUE);
  });

  it('makes a fuller block more opaque, and leaves an empty one clear', () => {
    const pixels = minimapPixels(blocks([4, 1]), [RED]);
    expect(pixels[3]).toBe(255);
    expect(pixels[7]).toBeGreaterThan(0);
    expect(pixels[7]).toBeLessThan(255);

    expect(minimapPixels(blocks([0, 0]), [RED])[3]).toBe(0);
  });

  it('clears a block a colony has left since the last time', () => {
    const out = minimapPixels(blocks([4, 0]), [RED]);
    minimapPixels(blocks([0, 4]), [RED], out);

    expect(out[3]).toBe(0);
    expect(out[7]).toBe(255);
  });
});
