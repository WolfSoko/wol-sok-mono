import { CursorShape } from './arena-painter';
import { drawCursors } from './canvas-cursors';

type DrawCall =
  | { op: 'fillRect'; style: string; args: number[] }
  | {
      op: 'beginPath' | 'arc' | 'stroke';
      style: string;
      lineWidth: number;
      args: number[];
    };

/** A 2D context that records the crosshair's calls with the style they use. */
function recordingContext() {
  const calls: DrawCall[] = [];
  const context = { fillStyle: '', strokeStyle: '', lineWidth: 1, calls };
  const fill = (...args: number[]) =>
    calls.push({ op: 'fillRect', style: context.fillStyle, args });
  const line =
    (op: 'beginPath' | 'arc' | 'stroke') =>
    (...args: number[]) =>
      calls.push({
        op,
        style: context.strokeStyle,
        lineWidth: context.lineWidth,
        args,
      });
  const recording = Object.assign(context, {
    fillRect: fill,
    beginPath: line('beginPath'),
    arc: line('arc'),
    stroke: line('stroke'),
  });
  return recording as unknown as CanvasRenderingContext2D & {
    calls: DrawCall[];
  };
}

describe('drawCursors on a grid of two cells per base cell', () => {
  /** Expected values below are worked out by hand for this unit. */
  const DOUBLE_UNIT = 2;
  const red = 'rgba(255,0,0,1)';
  const blue = 'rgba(0,0,255,1)';

  /** Off the diagonal, so swapped coordinates show. */
  const plain: CursorShape = {
    x: 50,
    y: 30,
    color: [255, 0, 0, 255],
    boostLeft: null,
  };
  /** A quarter left: an inverted boost would give another radius. */
  const boosted: CursorShape = {
    x: 90,
    y: 40,
    color: [0, 0, 255, 255],
    boostLeft: 0.25,
  };

  it('fills the crosshair bars twice as long and thick, without a ring', () => {
    const cx = recordingContext();

    drawCursors(cx, [plain], DOUBLE_UNIT);

    expect(cx.calls).toEqual([
      { op: 'fillRect', style: red, args: [38, 29, 26, 4] },
      { op: 'fillRect', style: red, args: [49, 18, 4, 26] },
    ]);
  });

  it('strokes the boost ring twice as wide, with a line twice as thick', () => {
    const cx = recordingContext();

    drawCursors(cx, [boosted], DOUBLE_UNIT);

    // Bars around (90, 40); radius (9 + 4 * (1 - 0.25)) * 2 = 24, line 1.5 * 2 = 3.
    expect(cx.calls).toEqual([
      { op: 'fillRect', style: blue, args: [78, 39, 26, 4] },
      { op: 'fillRect', style: blue, args: [89, 28, 4, 26] },
      { op: 'beginPath', style: blue, lineWidth: 3, args: [] },
      {
        op: 'arc',
        style: blue,
        lineWidth: 3,
        args: [90, 40, 24, 0, Math.PI * 2],
      },
      { op: 'stroke', style: blue, lineWidth: 3, args: [] },
    ]);
  });

  it('draws each crosshair in its own colour, each ring on a path of its own', () => {
    const cx = recordingContext();

    drawCursors(cx, [boosted, plain, boosted], DOUBLE_UNIT);

    const bars = (style: string) => [`fillRect ${style}`, `fillRect ${style}`];
    const ringed = (style: string) => [
      ...bars(style),
      `beginPath ${style}`,
      `arc ${style}`,
      `stroke ${style}`,
    ];
    const styles = cx.calls.map((call) => `${call.op} ${call.style}`);
    expect(styles).toEqual([...ringed(blue), ...bars(red), ...ringed(blue)]);
  });

  it('fills and strokes a translucent crosshair with its alpha from 0 to 1', () => {
    const cx = recordingContext();
    const translucent: CursorShape = { ...boosted, color: [0, 0, 255, 51] };

    drawCursors(cx, [translucent], DOUBLE_UNIT);

    const styles = new Set(cx.calls.map((call) => call.style));
    expect([...styles]).toEqual(['rgba(0,0,255,0.2)']);
    expect(cx.calls).toHaveLength(5);
  });
});
