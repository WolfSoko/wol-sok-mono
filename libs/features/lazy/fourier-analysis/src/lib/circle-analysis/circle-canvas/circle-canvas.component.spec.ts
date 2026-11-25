import { TestBed } from '@angular/core/testing';
import type P5 from 'p5';
import { createGeneratedInputWave } from '../../model/input-wave.model';
import { CircleCanvasComponent } from './circle-canvas.component';

// The sketch is driven by hand below; the real p5 needs a canvas.
jest.mock('p5', () => jest.fn());

type PointerHandler = () => boolean | void;

interface FakeSketch {
  mouseX: number;
  mouseY: number;
  redraw: jest.Mock;
  remove: jest.Mock;
  mousePressed?: PointerHandler;
  mouseMoved?: PointerHandler;
  touchStarted?: PointerHandler;
}

describe('CircleCanvasComponent', () => {
  let sketch: FakeSketch;

  beforeEach(() => {
    const fixture = TestBed.createComponent(CircleCanvasComponent);
    fixture.componentRef.setInput('waveWidth', 400);
    fixture.componentRef.setInput('waveHeight', 300);
    fixture.componentRef.setInput(
      'wave',
      createGeneratedInputWave({ points: [0, 1, 0, -1] })
    );
    sketch = { mouseX: 10, mouseY: 10, redraw: jest.fn(), remove: jest.fn() };
    fixture.componentInstance.initSketch(sketch as unknown as P5);
  });

  it('picks the frequency on a press, which p5 2 also reports for a tap', () => {
    expect(sketch.mousePressed).toBeInstanceOf(Function);
  });

  it('keeps the default of a press, so a tap still scrolls the page', () => {
    expect(sketch.mousePressed?.()).toBe(true);
  });

  it('installs no touchStarted handler, which p5 2 never calls', () => {
    expect(sketch.touchStarted).toBeUndefined();
  });
});
