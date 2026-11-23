import { drawingBufferSize, MAX_BUFFER_PIXELS } from './drawing-buffer';

describe('drawingBufferSize', () => {
  it('gives a small cell the device pixels, up to 1.5 a CSS pixel', () => {
    expect(drawingBufferSize(480, 360, 1)).toEqual({ width: 480, height: 360 });
    expect(drawingBufferSize(480, 360, 2)).toEqual({ width: 720, height: 540 });
  });

  it('lowers the scale of a large cell to the pixel budget, keeping 4:3', () => {
    const { width, height } = drawingBufferSize(2000, 1500, 1.5);

    expect(width * height).toBeLessThanOrEqual(MAX_BUFFER_PIXELS);
    expect(width * height).toBeGreaterThan(MAX_BUFFER_PIXELS * 0.99);
    expect(width / height).toBeCloseTo(4 / 3, 2);
  });

  it('keeps a full-HD cell at its full scale', () => {
    expect(drawingBufferSize(832, 624, 1.5).width).toBe(1248);
  });

  it('draws a widescreen cell at one device pixel a CSS pixel', () => {
    expect(drawingBufferSize(2036, 1527, 1)).toEqual({
      width: 2036,
      height: 1527,
    });
  });

  it('never gives a buffer below one pixel', () => {
    expect(drawingBufferSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
  });
});
