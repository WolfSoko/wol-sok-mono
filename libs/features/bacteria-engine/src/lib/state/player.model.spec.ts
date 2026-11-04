import { createBacteriaBlob } from './player.model';

describe('createBacteriaBlob', () => {
  it('fills a disc of whole cells', () => {
    const blob = createBacteriaBlob(10, 10, 3);
    const cells = new Set(blob.map(({ x, y }) => `${x},${y}`));

    expect(cells.size).toBe(blob.length);
    expect(cells.has('10,10')).toBe(true);
    expect(cells.has('7,10')).toBe(true);
    expect(cells.has('13,10')).toBe(false);
  });

  it('shrinks by area with a fractional radius - a head start a step at a time', () => {
    const [even, one, two] = [1, 0.85, 0.7].map(
      (area) => createBacteriaBlob(40, 40, 12 * Math.sqrt(area)).length
    );

    expect(one / even).toBeCloseTo(0.85, 1);
    expect(two / even).toBeCloseTo(0.7, 1);
  });
});
