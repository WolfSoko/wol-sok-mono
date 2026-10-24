import { BACTERIA_LOOKS } from '../state/skins';
import { previewColony, renderLookLayer, SKIN_PREVIEW } from './look-preview';

const ORANGE = [255, 100, 20];

describe('previewColony', () => {
  it('fills most of the arena, weaker towards the right', () => {
    const colony = previewColony(SKIN_PREVIEW);
    const cells = SKIN_PREVIEW.width * SKIN_PREVIEW.height;
    const left = colony.find((b) => b.x === 16 && b.y === 18);
    const right = colony.find((b) => b.x === 48 && b.y === 18);

    expect(colony.length).toBeGreaterThan(cells * 0.4);
    expect(colony.length).toBeLessThan(cells * 0.8);
    expect(left?.energy ?? 0).toBeGreaterThan(right?.energy ?? Infinity);
  });
});

describe('renderLookLayer', () => {
  it.each(BACTERIA_LOOKS)('paints the colony in its colour as %s', (look) => {
    const { data, width, height } = renderLookLayer(look, ORANGE, SKIN_PREVIEW);
    let painted = 0;
    let orange = 0;
    for (let i = 0; i < width * height; i++) {
      if (data[i * 4 + 3] > 0) {
        painted++;
        if (
          data[i * 4] >= data[i * 4 + 1] &&
          data[i * 4 + 1] >= data[i * 4 + 2]
        ) {
          orange++;
        }
      }
    }

    expect(painted).toBeGreaterThan((width * height) / 4);
    expect(orange).toBeGreaterThan(painted * 0.9);
  });

  it('draws every look differently', () => {
    const pictures = new Set(
      BACTERIA_LOOKS.map((look) =>
        renderLookLayer(look, ORANGE, SKIN_PREVIEW).data.join()
      )
    );

    expect(pictures.size).toBe(BACTERIA_LOOKS.length);
  });
});
