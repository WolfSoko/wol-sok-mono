import { WeaponFire } from '../state/evolution';
import { Camera, CameraShake, WEAPON_SHAKE } from './camera';

describe('Camera', () => {
  const WIDTH = 640;
  const HEIGHT = 360;

  it('shows the whole arena to begin with', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);

    expect(camera.viewRect()).toEqual({
      x: 0,
      y: 0,
      width: WIDTH,
      height: HEIGHT,
    });
  });

  it('closes in on its target at the zoom picked', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);
    for (let i = 0; i < 200; i++) {
      camera.follow({ x: 320, y: 180 }, 0.05);
    }

    const { x, y, width, height } = camera.viewRect();
    expect(width).toBeCloseTo(WIDTH / 2);
    expect(height).toBeCloseTo(HEIGHT / 2);
    // The middle of the arena in the middle of the view.
    expect(x).toBeCloseTo(160);
    expect(y).toBeCloseTo(90);
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
    expect(camera.viewRect()).toEqual({
      x: 0,
      y: expect.closeTo(HEIGHT / 2),
      width: expect.closeTo(WIDTH / 2),
      height: expect.closeTo(HEIGHT / 2),
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
    for (let i = 0; i < 200; i++) {
      camera.follow({ x: 100, y: 100 }, 0.05);
    }
    for (let i = 0; i < 200; i++) {
      camera.follow(null, 0.05);
    }
    expect(camera.view.x).toBeCloseTo(320);
    expect(camera.view.y).toBeCloseTo(180);
    expect(camera.view.zoom).toBeCloseTo(1);

    camera.follow({ x: 100, y: 100 }, 1);
    camera.reset();
    expect(camera.view).toEqual({ x: 320, y: 180, zoom: 1 });
  });

  it('tells when it has arrived, and nothing is left to ease', () => {
    const camera = new Camera(WIDTH, HEIGHT, 2);
    expect(camera.settledOn(null)).toBe(true);
    expect(camera.settledOn({ x: 100, y: 100 })).toBe(false);

    for (let i = 0; i < 200; i++) {
      camera.follow({ x: 100, y: 100 }, 0.05);
    }
    expect(camera.settledOn({ x: 100, y: 100 })).toBe(true);
  });
});

describe('CameraShake', () => {
  const WIDTH = 320;
  const HEIGHT = 180;
  const WHOLE = { x: 0, y: 0, width: WIDTH, height: HEIGHT };

  function fired(weapon: WeaponFire['weapon'], isBot = false): WeaponFire[] {
    return [{ playerId: 1, weapon, x: 100, y: 50, radius: 18, isBot }];
  }

  it('leaves the view alone while nothing goes off', () => {
    const shake = new CameraShake();
    shake.advance(0.1);

    expect(shake.shake(WHOLE, WIDTH, HEIGHT)).toBe(WHOLE);
  });

  it('shakes the view as a weapon goes off, inside the arena', () => {
    const shake = new CameraShake();
    shake.fire(fired('phage-strike'), false);

    for (let i = 0; i < 10; i++) {
      shake.advance(1 / 60);
      const view = shake.shake(WHOLE, WIDTH, HEIGHT);
      expect(view).not.toEqual(WHOLE);
      // Punched in a little, and never beyond an edge.
      expect(view.width).toBeLessThan(WIDTH);
      expect(view.width / view.height).toBeCloseTo(WIDTH / HEIGHT);
      expect(view.x).toBeGreaterThanOrEqual(0);
      expect(view.y).toBeGreaterThanOrEqual(0);
      expect(view.x + view.width).toBeLessThanOrEqual(WIDTH);
      expect(view.y + view.height).toBeLessThanOrEqual(HEIGHT);
    }
  });

  it('shakes hardest for the phage strike, and softer for the computer', () => {
    const strongest = Object.entries(WEAPON_SHAKE).sort(
      ([, a], [, b]) => b - a
    )[0][0];
    expect(strongest).toBe('phage-strike');

    const human = new CameraShake();
    human.fire(fired('toxin-bomb'), false);
    const bot = new CameraShake();
    bot.fire(fired('toxin-bomb', true), false);
    expect(bot.strength).toBeGreaterThan(0);
    expect(bot.strength).toBeLessThan(human.strength);
  });

  it('dies down within half a second', () => {
    const shake = new CameraShake();
    shake.fire(fired('phage-strike'), false);

    shake.advance(0.5);

    expect(shake.strength).toBe(0);
    expect(shake.shake(WHOLE, WIDTH, HEIGHT)).toBe(WHOLE);
  });

  it('keeps still for players who asked for less motion', () => {
    const shake = new CameraShake();

    shake.fire(fired('phage-strike'), true);
    shake.advance(1 / 60);

    expect(shake.strength).toBe(0);
    expect(shake.shake(WHOLE, WIDTH, HEIGHT)).toBe(WHOLE);
  });
});
