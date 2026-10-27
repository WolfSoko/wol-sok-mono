import { bufferSize, isSoftwareRenderer, shouldDraw } from './render-pacing';

describe('bufferSize', () => {
  it('should draw at the CSS size by default', () => {
    expect(bufferSize(1200, 1)).toBe(1200);
  });

  it('should draw a part of it, rounded', () => {
    expect(bufferSize(1201, 0.5)).toBe(601);
  });

  it('should keep the scale between 0.1 and 1 and the buffer non-empty', () => {
    expect(bufferSize(100, 2)).toBe(100);
    expect(bufferSize(100, 0)).toBe(10);
    expect(bufferSize(0, 0.5)).toBe(1);
  });
});

describe('shouldDraw', () => {
  it('should draw every frame without a cap, and always the first', () => {
    expect(shouldDraw(5, 0, 0)).toBe(true);
    expect(shouldDraw(5, null, 20)).toBe(true);
  });

  it('should draw every third frame of a 60 Hz display at 20 fps', () => {
    const frame = 1000 / 60;
    expect(shouldDraw(frame, 0, 20)).toBe(false);
    expect(shouldDraw(2 * frame, 0, 20)).toBe(false);
    expect(shouldDraw(3 * frame, 0, 20)).toBe(true);
  });
});

describe('isSoftwareRenderer', () => {
  it('should know the software renderers', () => {
    expect(
      isSoftwareRenderer(
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'
      )
    ).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
  });

  it('should take a hardware renderer, or none, for hardware', () => {
    expect(
      isSoftwareRenderer('ANGLE (Apple, ANGLE Metal Renderer: Apple M2)')
    ).toBe(false);
    expect(isSoftwareRenderer(null)).toBe(false);
  });
});
