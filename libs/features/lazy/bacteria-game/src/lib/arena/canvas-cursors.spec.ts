import { CursorShape } from './arena-painter';
import { drawCursors } from './canvas-cursors';

/** A 2D context that records the crosshair's calls with the style they use. */
function recordingContext() {
  const calls: {
    op: string;
    style: string;
    lineWidth: number;
    args: number[];
  }[] = [];
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    calls,
    beginPath: jest.fn(),
  };
  const record = (op: string, style: () => string) =>
    jest.fn((...args: number[]) =>
      calls.push({ op, style: style(), lineWidth: context.lineWidth, args })
    );
  return Object.assign(context, {
    fillRect: record('fillRect', () => context.fillStyle),
    arc: record('arc', () => context.strokeStyle),
    stroke: record('stroke', () => context.strokeStyle),
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

  it('fills the crosshair bars twice as long and thick, without a ring', () => {
    const cx = recordingContext();

    draw(
      cx,
      [{ x: 50, y: 30, color: [255, 0, 0, 255], boostLeft: null }],
      DOUBLE_UNIT
    );

    const red = 'rgba(255,0,0,255)';
    expect(cx.calls).toEqual([
      { op: 'fillRect', style: red, lineWidth: 1, args: [38, 29, 26, 4] },
      { op: 'fillRect', style: red, lineWidth: 1, args: [49, 18, 4, 26] },
    ]);
  });

  it('strokes the boost ring twice as wide, with a line twice as thick', () => {
    const cx = recordingContext();

    draw(
      cx,
      // A quarter left: an inverted boost would give another radius.
      [{ x: 90, y: 40, color: [0, 0, 255, 255], boostLeft: 0.25 }],
      DOUBLE_UNIT
    );

    const blue = 'rgba(0,0,255,255)';
    const ring = cx.calls.filter((call) => call.op !== 'fillRect');
    // Radius (9 + 4 * (1 - 0.25)) * 2 = 24, line 1.5 * 2 = 3.
    expect(ring).toEqual([
      {
        op: 'arc',
        style: blue,
        lineWidth: 3,
        args: [90, 40, 24, 0, Math.PI * 2],
      },
      { op: 'stroke', style: blue, lineWidth: 3, args: [] },
    ]);
    expect(cx.beginPath).toHaveBeenCalledTimes(1);
  });
});
