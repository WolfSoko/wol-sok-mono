import { AMBIENCE, DishAmbience } from './ambience';
import { arenaTheme } from './arena-theme';

/** A context that only counts what is drawn on it. */
function fakeContext() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const cx = {
    calls,
    globalAlpha: 1,
    fillStyle: '' as unknown,
    strokeStyle: '',
    lineWidth: 1,
    clearRect: () => calls.push('clearRect'),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => undefined,
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    fillRect: () => calls.push('fillRect'),
    drawImage: () => calls.push('drawImage'),
    createLinearGradient: () => gradient,
  };
  return cx as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe('DishAmbience', () => {
  const view = { x: 0, y: 0, width: 320, height: 180 };

  it('lets a few dozen bubbles rise, and starts each again at the bottom', () => {
    const ambience = new DishAmbience(320, 180, () => 0.5);
    const before = ambience.bubblesNow();
    expect(before).toHaveLength(Math.round((320 * 180) / 1400));

    ambience.advance(1);
    const after = ambience.bubblesNow();
    after.forEach((bubble, index) => {
      expect(bubble.y).toBeLessThan(before[index].y);
    });

    // Long enough for every bubble to leave at the top.
    for (let i = 0; i < 200; i++) {
      ambience.advance(0.5);
    }
    ambience.bubblesNow().forEach((bubble) => {
      expect(bubble.y).toBeGreaterThan(-bubble.radius - 0.001);
      expect(bubble.y).toBeLessThanOrEqual(180 + bubble.radius);
    });
  });

  it('draws the bubbles with three strokes and the depth of the dish over them', () => {
    const ambience = new DishAmbience(320, 180, () => 0.5);
    ambience.setTheme(arenaTheme('petri-dish'));
    const cx = fakeContext();

    ambience.paint(cx, view, 640, 360, true);

    expect(cx.calls[0]).toBe('clearRect');
    expect(cx.calls.filter((call) => call === 'fill')).toHaveLength(2);
    expect(cx.calls.filter((call) => call === 'stroke')).toHaveLength(1);
    expect(cx.calls.filter((call) => call === 'arc').length).toBe(
      2 * ambience.bubblesNow().length
    );
    // The rim's four edges and the sheen.
    expect(cx.calls.filter((call) => call === 'fillRect')).toHaveLength(5);
  });

  it('draws nothing that moves for a player who asked for less motion', () => {
    const ambience = new DishAmbience(320, 180, () => 0.5);
    const cx = fakeContext();

    ambience.paint(cx, view, 640, 360, false);

    expect(cx.calls.filter((call) => call === 'arc')).toHaveLength(0);
    expect(cx.calls.filter((call) => call === 'fillRect')).toHaveLength(5);
  });

  it('draws only the bubbles in view of the camera', () => {
    const ambience = new DishAmbience(320, 180, () => 0.5);
    const cx = fakeContext();

    // All bubbles sit at x = 160 - a view to the far left shows none.
    ambience.paint(cx, { x: 0, y: 0, width: 80, height: 45 }, 640, 360, true);

    expect(cx.calls.filter((call) => call === 'arc')).toHaveLength(0);
    expect(AMBIENCE.rimWidth).toBeGreaterThan(0);
  });
});
