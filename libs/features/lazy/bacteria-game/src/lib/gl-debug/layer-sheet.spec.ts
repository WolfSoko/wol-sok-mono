import { LABEL_HEIGHT, sheetLayout, splitAlpha } from './layer-sheet';

describe('sheetLayout', () => {
  it('stacks the layers, each under its label, its alpha beside its colours', () => {
    const layout = sheetLayout([
      { label: 'trail', width: 64, height: 32 },
      { label: 'glow', width: 32, height: 16 },
    ]);

    expect(layout).toEqual({
      width: 128,
      height: 2 * LABEL_HEIGHT + 32 + 16,
      placements: [
        { label: 'trail', labelY: 0, imageY: LABEL_HEIGHT, alphaX: 64 },
        {
          label: 'glow',
          labelY: LABEL_HEIGHT + 32,
          imageY: 2 * LABEL_HEIGHT + 32,
          alphaX: 32,
        },
      ],
    });
  });
});

describe('splitAlpha', () => {
  it('shows the colours opaque, and the alpha as grey', () => {
    const { colors, alpha } = splitAlpha(
      Uint8Array.from([10, 20, 30, 0, 1, 2, 3, 255])
    );

    expect(Array.from(colors)).toEqual([10, 20, 30, 255, 1, 2, 3, 255]);
    expect(Array.from(alpha)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});
