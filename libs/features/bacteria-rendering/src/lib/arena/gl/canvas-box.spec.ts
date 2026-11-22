import { canvasBox, clipBox } from './canvas-box';

describe('canvasBox', () => {
  const VIEW = { x: 0, y: 0, width: 32, height: 16 };

  it('scales a box of cells to the pixels of the target, row 0 at the bottom', () => {
    expect(canvasBox([4, 2, 10, 6], VIEW, 64, 32)).toEqual({
      left: 8,
      bottom: 20,
      right: 20,
      top: 28,
    });
  });

  it('rounds out to whole pixels where a cell edge falls inside one', () => {
    // 7.5 pixels a cell: cell 1 starts at 7.5, cell 3 ends at 22.5.
    const view = { x: 0, y: 0, width: 4, height: 4 };

    expect(canvasBox([1, 1, 3, 3], view, 30, 30)).toEqual({
      left: 7,
      bottom: 7,
      right: 23,
      top: 23,
    });
  });

  it('cuts the box to the target', () => {
    const view = { x: 8, y: 4, width: 16, height: 8 };

    expect(canvasBox([0, 0, 12, 6], view, 32, 16)).toEqual({
      left: 0,
      bottom: 12,
      right: 8,
      top: 16,
    });
  });

  it('is empty for a box out of view', () => {
    const box = canvasBox([40, 2, 44, 6], VIEW, 64, 32);

    expect(box.right - box.left).toBe(0);
  });
});

describe('clipBox', () => {
  it('turns pixels of the target into clip space, -1 to 1', () => {
    expect(clipBox({ left: 16, bottom: 0, right: 64, top: 8 }, 64, 32)).toEqual(
      [-0.5, -1, 1, -0.5]
    );
  });
});
