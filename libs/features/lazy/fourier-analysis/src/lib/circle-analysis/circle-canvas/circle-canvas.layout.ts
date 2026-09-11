/**
 * Geometry of the circle canvas.
 *
 * On wide screens the wrapped wave circle sits on the left and the frequency
 * graph next to it. On narrow (mobile) screens there is no room for that, so
 * the graph moves below the circle and uses the full canvas width.
 */

export const CIRCLE_CANVAS_PADDING = 30;

/** Canvas widths below this value use the stacked (mobile) layout. */
export const CIRCLE_CANVAS_STACK_BREAKPOINT = 700;

const MIN_CIRCLE_SIZE = 120;
const MAX_STACKED_CIRCLE_SIZE = 360;
const STACKED_GRAPH_HEIGHT = 240;
const MIN_STACKED_GRAPH_HEIGHT = 160;
const MIN_WIDE_CANVAS_HEIGHT = 250;
const WIDE_CANVAS_ASPECT_RATIO = 9 / 94;
const CIRCLE_GRAPH_GAP = 24;

export interface CircleCanvasLayout {
  /** `true` when the graph is drawn below instead of next to the circle. */
  stacked: boolean;
  /** Side length of the square area the circle is drawn into. */
  circleSize: number;
  circleX: number;
  circleY: number;
  graphLeft: number;
  graphRight: number;
  graphTop: number;
  graphBottom: number;
}

export function isStackedCircleCanvasLayout(width: number): boolean {
  return width < CIRCLE_CANVAS_STACK_BREAKPOINT;
}

/**
 * Canvas height needed to show both the circle and the frequency graph at the
 * given canvas width.
 */
export function circleCanvasHeightFor(width: number): number {
  if (isStackedCircleCanvasLayout(width)) {
    return Math.round(stackedCircleSize(width) + STACKED_GRAPH_HEIGHT);
  }
  return Math.max(
    MIN_WIDE_CANVAS_HEIGHT,
    Math.round(width * WIDE_CANVAS_ASPECT_RATIO)
  );
}

export function circleCanvasLayout(
  width: number,
  height: number
): CircleCanvasLayout {
  const padding = CIRCLE_CANVAS_PADDING;

  if (isStackedCircleCanvasLayout(width)) {
    const circleSize = Math.max(
      MIN_CIRCLE_SIZE,
      Math.min(
        stackedCircleSize(width),
        height - MIN_STACKED_GRAPH_HEIGHT,
        height
      )
    );
    return {
      stacked: true,
      circleSize,
      circleX: Math.round((width - circleSize) / 2),
      circleY: 0,
      graphLeft: padding,
      graphRight: width - padding,
      graphTop: circleSize + padding / 2,
      graphBottom: height - padding,
    };
  }

  const circleSize = Math.max(MIN_CIRCLE_SIZE, Math.min(height, width / 2));
  return {
    stacked: false,
    circleSize,
    circleX: 0,
    circleY: 0,
    graphLeft: circleSize + CIRCLE_GRAPH_GAP,
    graphRight: width - padding,
    graphTop: padding,
    graphBottom: height - padding,
  };
}

function stackedCircleSize(width: number): number {
  return Math.max(MIN_CIRCLE_SIZE, Math.min(width, MAX_STACKED_CIRCLE_SIZE));
}
