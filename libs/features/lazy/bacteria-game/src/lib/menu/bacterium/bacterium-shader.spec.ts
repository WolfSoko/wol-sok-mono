import { CELL_SCALE } from './bacterium-items';
import { BACTERIUM_FRAGMENT } from './bacterium-shader';

describe('BACTERIUM_FRAGMENT', () => {
  it("draws the box at the canvas's scale, fading out at its edge (#3240)", () => {
    expect(BACTERIUM_FRAGMENT).toContain(
      `const float CELL_SCALE = ${CELL_SCALE.toFixed(5)};`
    );
    expect(BACTERIUM_FRAGMENT).toContain('vec2 box = vUv * CELL_SCALE;');
    expect(BACTERIUM_FRAGMENT).toContain('float edgeFade()');
  });
});
