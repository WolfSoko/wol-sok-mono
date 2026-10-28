import { AMBIENCE, DishAmbience } from './ambience';
import { arenaTheme } from './arena-theme';

/** A context that only counts what is drawn on it, and where the arcs go. */
function fakeContext() {
  const calls: string[] = [];
  const arcs: { x: number; y: number; r: number }[] = [];
  const gradient = { addColorStop: () => undefined };
  const cx = {
    calls,
    arcs,
    globalAlpha: 1,
    fillStyle: '' as unknown,
    strokeStyle: '',
    lineWidth: 1,
    clearRect: () => calls.push('clearRect'),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => undefined,
    arc: (x: number, y: number, r: number) => {
      calls.push('arc');
      arcs.push({ x, y, r });
    },
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    fillRect: () => calls.push('fillRect'),
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    drawImage: () => calls.push('drawImage'),
    createLinearGradient: () => gradient,
  };
  return cx as unknown as CanvasRenderingContext2D & {
    calls: string[];
    arcs: { x: number; y: number; r: number }[];
  };
}

/** The bubbles a frame drew: the first arc of each, its film, in canvas pixels. */
function bubblesDrawn(ambience: DishAmbience, view = VIEW) {
  const cx = fakeContext();
  ambience.paint(cx, view, 640, 360, true);
  return cx.arcs.slice(0, cx.arcs.length / 2);
}

const VIEW = { x: 0, y: 0, width: 320, height: 180 };

describe('DishAmbience', () => {
  const view = VIEW;

  it('lets a few dozen bubbles rise, and starts each again at the bottom', () => {
    const ambience = new DishAmbience(320, 180, () => 0.5);
    const before = bubblesDrawn(ambience);
    expect(before).toHaveLength(Math.round((320 * 180) / 1400));

    ambience.advance(1);
    const after = bubblesDrawn(ambience);
    after.forEach((bubble, index) => {
      expect(bubble.y).toBeLessThan(before[index].y);
    });

    // Long enough for every bubble to leave at the top - and come back.
    for (let i = 0; i < 200; i++) {
      ambience.advance(0.5);
    }
    const again = bubblesDrawn(ambience);
    expect(again).toHaveLength(before.length);
    again.forEach((bubble) => {
      expect(bubble.y).toBeGreaterThan(-bubble.r - 0.001);
      expect(bubble.y).toBeLessThanOrEqual(360 + bubble.r);
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
      2 * Math.round((320 * 180) / 1400)
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

describe('DishAmbience shapes', () => {
  it('hands over each wisp and the bubbles in view, in arena cells', () => {
    const ambience = new DishAmbience(320, 180, () => 0.5);
    const wisps: number[][] = [];
    ambience.forEachWisp((...wisp) => wisps.push(wisp));
    const all: number[][] = [];
    ambience.forEachBubble({ x: 0, y: 0, width: 320, height: 180 }, (...b) =>
      all.push(b)
    );
    const left: number[][] = [];
    ambience.forEachBubble({ x: 0, y: 0, width: 100, height: 180 }, (...b) =>
      left.push(b)
    );

    expect(wisps).toHaveLength(AMBIENCE.wisps);
    expect(all.length).toBeGreaterThan(0);
    for (const [x, , radius] of left) {
      expect(x - radius).toBeLessThan(100);
    }
  });
});
