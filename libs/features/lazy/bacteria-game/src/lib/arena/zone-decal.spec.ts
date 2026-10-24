import { paintZoneLayer } from './zone-decal';
import { ZONE_COLORS } from './zone-look';
import { Zone } from '../state/zones';

const WIDTH = 320;
const HEIGHT = 180;
const SCALE = 2;

describe('paintZoneLayer', () => {
  const poison: Zone = {
    kind: 'antibiotic',
    x: 100,
    y: 40,
    width: 60,
    height: 60,
    round: true,
  };

  /** The colour and alpha of the layer at an arena point. */
  function at(
    layer: NonNullable<ReturnType<typeof paintZoneLayer>>,
    x: number,
    y: number
  ): number[] {
    const i = (Math.floor(y * SCALE) * layer.width + Math.floor(x * SCALE)) * 4;
    return Array.from(layer.data.slice(i, i + 4));
  }

  it('paints nothing without zones', () => {
    expect(paintZoneLayer(WIDTH, HEIGHT, [], SCALE, 1)).toBeNull();
  });

  it('is finer than the cells, and clear outside the zones', () => {
    const layer = paintZoneLayer(WIDTH, HEIGHT, [poison], SCALE, 1);
    if (layer === null) {
      throw new Error('no layer');
    }

    expect(layer.width).toBe(WIDTH * SCALE);
    expect(at(layer, 20, 20)[3]).toBe(0);
  });

  it('tints the inside lightly and the rim strongly, in the zone colour', () => {
    const layer = paintZoneLayer(WIDTH, HEIGHT, [poison], SCALE, 1);
    if (layer === null) {
      throw new Error('no layer');
    }

    const rim = at(layer, 130, 40.5);
    const inside = at(layer, 104, 70);
    expect(rim[3]).toBeGreaterThan(inside[3]);
    expect(inside[3]).toBeGreaterThan(0);
    expect(inside.slice(0, 3)).toEqual([...ZONE_COLORS.antibiotic]);
  });

  it('softens the edge - alphas between clear and the rim', () => {
    const layer = paintZoneLayer(WIDTH, HEIGHT, [poison], SCALE, 1);
    if (layer === null) {
      throw new Error('no layer');
    }
    const alphas = new Set<number>();
    for (let i = 3; i < layer.data.length; i += 4) {
      alphas.add(layer.data[i]);
    }

    // More than clear, fill and rim: the blurred steps of the edge.
    expect(alphas.size).toBeGreaterThan(5);
  });

  it('strews antibiotic with red pills', () => {
    const layer = paintZoneLayer(WIDTH, HEIGHT, [poison], SCALE, 1);
    if (layer === null) {
      throw new Error('no layer');
    }
    let red = 0;
    for (let i = 0; i < layer.data.length; i += 4) {
      const [r, g, b, a] = layer.data.slice(i, i + 4);
      if (a > 200 && r > 200 && g < 100 && b < 110) {
        red++;
      }
    }

    expect(red).toBeGreaterThan(0);
  });

  it('paints the same zones the same way every time', () => {
    const zones: Zone[] = [
      poison,
      { kind: 'agar', x: 200, y: 60, width: 50, height: 50, round: true },
    ];

    expect(paintZoneLayer(WIDTH, HEIGHT, zones, SCALE, 1)?.data).toEqual(
      paintZoneLayer(WIDTH, HEIGHT, zones, SCALE, 1)?.data
    );
  });
});
