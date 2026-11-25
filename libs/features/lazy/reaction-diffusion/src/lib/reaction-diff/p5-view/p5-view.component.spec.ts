import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type P5 from 'p5';
import { ReactionDiffCalculator } from '../calculation/reaction-diff-calculator';
import { P5ViewComponent } from './p5-view.component';

type Sketch = Partial<
  Record<
    'mouseClicked' | 'mouseDragged' | 'touchStarted' | 'touchMoved',
    () => boolean
  >
> & { mouseX: number; mouseY: number; width: number; height: number };

let mockSketch: Sketch;

jest.mock('p5', () =>
  jest.fn().mockImplementation((init: (p: P5) => void) => {
    mockSketch = { mouseX: 0, mouseY: 0, width: 100, height: 50 };
    const p = Object.assign(mockSketch, { floor: Math.floor });
    init(p as unknown as P5);
    return { remove: jest.fn(), resizeCanvas: jest.fn() };
  })
);

describe('P5ViewComponent', () => {
  let calcService: jest.Mocked<Pick<ReactionDiffCalculator, 'addChemical'>>;

  beforeEach(() => {
    calcService = { addChemical: jest.fn() };
    const fixture = TestBed.createComponent(P5ViewComponent);
    const view = fixture.componentInstance;
    view.simWidth = 100;
    view.simHeight = 50;
    view.calcService = calcService as unknown as ReactionDiffCalculator;
    view.ngOnChanges({ simWidth: new SimpleChange(undefined, 100, true) });
  });

  it('adds chemical through the pointer handlers, which p5 2 also calls for touch', () => {
    mockSketch.mouseX = 10.7;
    mockSketch.mouseY = 20.2;

    expect(mockSketch.mouseDragged?.()).toBe(false);
    expect(mockSketch.mouseClicked?.()).toBe(false);

    expect(calcService.addChemical).toHaveBeenNthCalledWith(1, 10, 20);
    expect(calcService.addChemical).toHaveBeenNthCalledWith(2, 10, 20);
    expect(calcService.addChemical).toHaveBeenCalledTimes(2);
  });

  it('installs no touch handlers, which p5 2 never calls', () => {
    expect(mockSketch.touchStarted).toBeUndefined();
    expect(mockSketch.touchMoved).toBeUndefined();
  });

  it('leaves a press outside the canvas to the page', () => {
    mockSketch.mouseX = 150;
    mockSketch.mouseY = 20;

    expect(mockSketch.mouseDragged?.()).toBe(true);
    expect(mockSketch.mouseClicked?.()).toBe(true);
    expect(calcService.addChemical).not.toHaveBeenCalled();
  });
});
