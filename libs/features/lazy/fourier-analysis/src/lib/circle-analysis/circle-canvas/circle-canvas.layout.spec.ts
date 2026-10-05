import {
  CIRCLE_CANVAS_STACK_BREAKPOINT,
  circleCanvasHeightFor,
  circleCanvasLayout,
  isStackedCircleCanvasLayout,
} from './circle-canvas.layout';

describe('circleCanvasLayout', () => {
  const mobileWidth = 360;
  const desktopWidth = 1200;

  it('stacks below the breakpoint and keeps the circle next to the graph above it', () => {
    expect(
      isStackedCircleCanvasLayout(CIRCLE_CANVAS_STACK_BREAKPOINT - 1)
    ).toBe(true);
    expect(isStackedCircleCanvasLayout(CIRCLE_CANVAS_STACK_BREAKPOINT)).toBe(
      false
    );
  });

  it('gives the graph the full width below the circle on mobile', () => {
    const layout = circleCanvasLayout(
      mobileWidth,
      circleCanvasHeightFor(mobileWidth)
    );

    expect(layout.stacked).toBe(true);
    expect(layout.graphTop).toBeGreaterThan(
      layout.circleY + layout.circleSize - 1
    );
    expect(layout.graphLeft).toBeLessThan(layout.circleX + layout.circleSize);
    expect(layout.graphRight).toBeLessThanOrEqual(mobileWidth);
  });

  it('places the graph right of the circle on wide canvases', () => {
    const layout = circleCanvasLayout(
      desktopWidth,
      circleCanvasHeightFor(desktopWidth)
    );

    expect(layout.stacked).toBe(false);
    expect(layout.graphLeft).toBeGreaterThanOrEqual(layout.circleSize);
    expect(layout.graphRight).toBeLessThanOrEqual(desktopWidth);
  });

  it.each([320, 360, 414, 600, 699, 700, 1024, 1920])(
    'keeps a visible graph area at %ipx',
    (width) => {
      const height = circleCanvasHeightFor(width);
      const layout = circleCanvasLayout(width, height);

      expect(layout.graphRight).toBeGreaterThan(layout.graphLeft);
      expect(layout.graphBottom).toBeGreaterThan(layout.graphTop);
      expect(layout.circleY + layout.circleSize).toBeLessThanOrEqual(height);
      expect(layout.circleX + layout.circleSize).toBeLessThanOrEqual(width);
    }
  );

  it('reserves room for both the circle and the graph on mobile', () => {
    expect(circleCanvasHeightFor(mobileWidth)).toBeGreaterThan(
      circleCanvasLayout(mobileWidth, circleCanvasHeightFor(mobileWidth))
        .circleSize
    );
  });
});
