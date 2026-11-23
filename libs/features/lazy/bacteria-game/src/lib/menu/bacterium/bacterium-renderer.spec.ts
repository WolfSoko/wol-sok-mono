import { BACTERIUM_ANCHORS } from './bacterium-items';
import { type BacteriumLobe, packLobes } from './bacterium-renderer';
import { MAX_LOBES } from './bacterium-shader';

describe('packLobes', () => {
  const online: BacteriumLobe = { ...BACTERIUM_ANCHORS.online, ready: false };
  const colony: BacteriumLobe = { ...BACTERIUM_ANCHORS.colony, ready: true };

  it('writes x, y, radius and whether the lobe is ready, four floats a lobe', () => {
    const data = new Float32Array(MAX_LOBES * 4);
    expect(packLobes([online, colony], data)).toBe(2);
    expect(Array.from(data.slice(0, 8))).toEqual(
      [online.x, online.y, online.r, 0, colony.x, colony.y, colony.r, 1].map(
        Math.fround
      )
    );
  });

  it('clears what an earlier frame left behind', () => {
    const data = new Float32Array(MAX_LOBES * 4).fill(7);
    packLobes([colony], data);
    expect(data.slice(4).every((value) => value === 0)).toBe(true);
  });

  it('packs at most MAX_LOBES', () => {
    const data = new Float32Array(MAX_LOBES * 4);
    const many = Array.from({ length: MAX_LOBES + 3 }, () => colony);
    expect(packLobes(many, data)).toBe(MAX_LOBES);
  });
});
