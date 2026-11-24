import { CELL_SCALE } from './bacterium-items';
import { BACTERIUM_FRAGMENT } from './bacterium-shader';

describe('BACTERIUM_FRAGMENT', () => {
  it("draws the box at the canvas's scale, so the bleed shows the cell's ends (#3240)", () => {
    expect(BACTERIUM_FRAGMENT).toContain(
      `const float CELL_SCALE = ${CELL_SCALE.toFixed(5)};`
    );
    expect(BACTERIUM_FRAGMENT).toContain('vec2 box = vUv * CELL_SCALE;');
  });

  it('fades every colour out at the canvas edge', () => {
    expect(BACTERIUM_FRAGMENT.match(/\* edgeFade\(\);/g)).toHaveLength(2);
  });
});
