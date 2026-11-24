import { CELL_SCALE } from './bacterium-items';
import {
  drawingBufferSize,
  MAX_BOX_PIXELS,
  MAX_BUFFER_PIXELS,
} from './drawing-buffer';

describe('drawingBufferSize', () => {
  it('gives a small cell the device pixels, up to 1.5 a CSS pixel', () => {
    expect(drawingBufferSize(480, 360, 1)).toEqual({ width: 480, height: 360 });
    expect(drawingBufferSize(480, 360, 2)).toEqual({ width: 720, height: 540 });
  });

  it("budgets the canvas the box's pixels and its bleed's (#3240)", () => {
    expect(MAX_BUFFER_PIXELS).toBeCloseTo(MAX_BOX_PIXELS * CELL_SCALE ** 2);
  });

  it('lowers the scale of a large cell to the pixel budget, keeping 4:3', () => {
    const { width, height } = drawingBufferSize(2600, 1950, 1.5);

    expect(width * height).toBeLessThanOrEqual(MAX_BUFFER_PIXELS);
    expect(width * height).toBeGreaterThan(MAX_BUFFER_PIXELS * 0.99);
    expect(width / height).toBeCloseTo(4 / 3, 2);
  });

  it('keeps the canvas of a full-HD cell at its full scale', () => {
    expect(
      drawingBufferSize(832 * CELL_SCALE, 624 * CELL_SCALE, 1.5).width
    ).toBe(1622);
  });

  it('draws the canvas of a widescreen cell at one device pixel a CSS pixel', () => {
    const width = Math.round(2036 * CELL_SCALE);
    const height = Math.round(1527 * CELL_SCALE);

    expect(drawingBufferSize(width, height, 1)).toEqual({ width, height });
  });

  it('rounds a small cell as before', () => {
    expect(drawingBufferSize(333, 250, 1.5)).toEqual({
      width: 500,
      height: 375,
    });
  });

  it('never gives a buffer below one pixel', () => {
    expect(drawingBufferSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
  });
});
