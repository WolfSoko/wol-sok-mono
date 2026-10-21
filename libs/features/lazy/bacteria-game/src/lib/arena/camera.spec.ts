import { Camera } from './camera';

describe('Camera', () => {
  const WIDTH = 640;
  const HEIGHT = 360;

  it('shows the whole arena to begin with', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);

    expect(camera.transform()).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('closes in on its target at the zoom picked', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);
    for (let i = 0; i < 200; i++) {
      camera.follow({ x: 320, y: 180 }, 0.05);
    }

    const { x, y, scale } = camera.transform();
    expect(scale).toBeCloseTo(2);
    // The middle of the arena in the middle of the view.
    expect(x).toBeCloseTo(-50);
    expect(y).toBeCloseTo(-50);
  });

  it('eases towards its target instead of jumping', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);

    camera.follow({ x: 600, y: 180 }, 0.05);

    expect(camera.view.x).toBeGreaterThan(320);
    expect(camera.view.x).toBeLessThan(400);
  });

  it('never shows beyond the edge of the arena', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);
    for (let i = 0; i < 200; i++) {
      camera.follow({ x: 0, y: HEIGHT }, 0.05);
    }

    // The left edge at the left of the view, the bottom at the bottom.
    expect(camera.transform()).toEqual({
      x: 0,
      y: expect.closeTo(-100),
      scale: expect.closeTo(2),
    });
  });

  it('zooms between the whole arena and a base map', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);
    camera.zoomBy(0.1);
    for (let i = 0; i < 200; i++) {
      camera.follow({ x: 100, y: 100 }, 0.05);
    }
    expect(camera.view.zoom).toBeCloseTo(1);

    camera.zoomBy(100);
    for (let i = 0; i < 200; i++) {
      camera.follow({ x: 100, y: 100 }, 0.05);
    }
    expect(camera.view.zoom).toBeCloseTo(2);
  });

  it('goes back to the whole arena without a target, and on a reset', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);
    camera.follow({ x: 100, y: 100 }, 1);
    camera.reset();

    expect(camera.view).toEqual({ x: 320, y: 180, zoom: 1 });
  });
});
