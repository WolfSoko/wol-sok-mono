import { CursorShape } from './arena-painter';
import { drawCursors } from './canvas-cursors';

interface DrawCall {
  op: 'fillRect' | 'beginPath' | 'arc' | 'stroke';
  /** The fill style for a fill, the stroke style otherwise. */
  style: string;
  lineWidth: number;
  args: number[];
}

/** A 2D context that records the crosshair's calls with the style they use. */
function recordingContext() {
  const calls: DrawCall[] = [];
  const context = { fillStyle: '', strokeStyle: '', lineWidth: 1, calls };
  const record =
    (op: DrawCall['op']) =>
    (...args: number[]) => {
      const style = op === 'fillRect' ? context.fillStyle : context.strokeStyle;
      calls.push({ op, style, lineWidth: context.lineWidth, args });
    };
  return Object.assign(context, {
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    arc: record('arc'),
    stroke: record('stroke'),
  });
}

type RecordingContext = ReturnType<typeof recordingContext>;

function draw(
  cx: RecordingContext,
  cursors: CursorShape[],
  unit: number
): void {
  drawCursors(cx as unknown as CanvasRenderingContext2D, cursors, unit);
}

describe('drawCursors on a grid of two cells per base cell', () => {
  /** Expected values below are worked out by hand for this unit. */
  const DOUBLE_UNIT = 2;
  const red = 'rgba(255,0,0,255)';
  const blue = 'rgba(0,0,255,255)';

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

    draw(cx, [plain], DOUBLE_UNIT);

    expect(cx.calls).toEqual([
      { op: 'fillRect', style: red, lineWidth: 1, args: [38, 29, 26, 4] },
      { op: 'fillRect', style: red, lineWidth: 1, args: [49, 18, 4, 26] },
    ]);
  });

  it('strokes the boost ring twice as wide, with a line twice as thick', () => {
    const cx = recordingContext();

    draw(cx, [boosted], DOUBLE_UNIT);

    // Bars around (90, 40); radius (9 + 4 * (1 - 0.25)) * 2 = 24, line 1.5 * 2 = 3.
    expect(cx.calls).toEqual([
      { op: 'fillRect', style: blue, lineWidth: 1, args: [78, 39, 26, 4] },
      { op: 'fillRect', style: blue, lineWidth: 1, args: [89, 28, 4, 26] },
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

    draw(cx, [boosted, plain, boosted], DOUBLE_UNIT);

    const styles = cx.calls.map((call) => `${call.op} ${call.style}`);
    expect(styles).toEqual([
      `fillRect ${blue}`,
      `fillRect ${blue}`,
      `beginPath ${blue}`,
      `arc ${blue}`,
      `stroke ${blue}`,
      `fillRect ${red}`,
      `fillRect ${red}`,
      `fillRect ${blue}`,
      `fillRect ${blue}`,
      `beginPath ${blue}`,
      `arc ${blue}`,
      `stroke ${blue}`,
    ]);
  });
});
