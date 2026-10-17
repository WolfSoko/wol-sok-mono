import { TestBed } from '@angular/core/testing';
import { BrainService } from './brain.service';
import { Point } from './point';

describe('BrainService', () => {
  let service: BrainService;

  const gridPoints = (): Point[] => {
    const points: Point[] = [];
    for (let x = 0.05; x < 1; x += 0.1) {
      for (let y = 0.05; y < 1; y += 0.1) {
        points.push(new Point(x, y));
      }
    }
    return points;
  };

  const accuracy = (points: Point[]) =>
    points.filter((point) => service.guessSilent(point.data) === point.label)
      .length / points.length;

  beforeEach(() => {
    jest.useFakeTimers();
    service = TestBed.inject(BrainService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('trains a multi layer net with back propagation', () => {
    service.createMultiPerceptron(2, [2, 3, 1]);
    service.points = gridPoints();

    for (let i = 0; i < 2000; i++) {
      service.train();
    }

    expect(accuracy(service.points)).toBeGreaterThan(0.9);
  });

  it('returns the sigmoid output of the multi layer net as activation', () => {
    service.createMultiPerceptron(2, [2, 3, 1]);

    const activation = service.activationSilent([0.2, 0.7]);

    expect(activation).toBeGreaterThan(0);
    expect(activation).toBeLessThan(1);
    expect(service.guessSilent([0.2, 0.7])).toBe(activation < 0.5 ? 0 : 1);
  });

  it('trains a single perceptron', () => {
    service.createPerceptron(2);
    service.points = gridPoints();

    for (let i = 0; i < 500; i++) {
      service.train();
    }

    expect(accuracy(service.points)).toBeGreaterThan(0.9);
  });
});
