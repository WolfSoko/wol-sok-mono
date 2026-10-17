import { TestBed } from '@angular/core/testing';
import { BrainService, diagonalLabel, LabelDefinition } from './brain.service';
import { TrainData } from './train-data';
import { Point, toLabelClass } from './point';

// mulberry32: a tiny seeded PRNG so weights and sampling are the same on every run
const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('BrainService', () => {
  let service: BrainService;

  const gridPoints = (labelDefinition = diagonalLabel): Point[] => {
    const points: Point[] = [];
    for (let x = 0.05; x < 1; x += 0.1) {
      for (let y = 0.05; y < 1; y += 0.1) {
        points.push(new Point(x, y, labelDefinition));
      }
    }
    return points;
  };

  const accuracy = (points: Point[]) =>
    points.filter((point) => service.guessSilent(point.data) === point.label)
      .length / points.length;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(42));
    TestBed.configureTestingModule({ providers: [BrainService] });
    service = TestBed.inject(BrainService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const circle: LabelDefinition = (x, y) =>
    (x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.09 ? 1 : 0;
  const xor: LabelDefinition = (x, y) => (x > 0.5 !== y > 0.5 ? 1 : 0);

  it.each([
    ['diagonal', diagonalLabel],
    ['circle', circle],
    ['xor', xor],
  ])('learns the %s border with one hidden layer', (_, labelDefinition) => {
    service.createMultiPerceptron(2, [8, 1]);
    service.points = gridPoints(labelDefinition);

    for (let i = 0; i < 1500; i++) {
      service.train();
    }

    expect(accuracy(service.points)).toBeGreaterThan(0.9);
  });

  it('changes every weight by -learnRate * gradient of the cross-entropy loss', () => {
    service.createMultiPerceptron(2, [3, 2, 1]);
    const trainData = new TrainData([0.3, 0.8], 1);
    const loss = () => {
      const output = service.activationSilent(trainData.inputs);
      return -Math.log(output);
    };
    const eps = 1e-6;
    const parameters = service.perceptrons.flat().flatMap((perceptron) => [
      ...perceptron.weights.map((_, i) => ({
        get: () => perceptron.weights[i],
        set: (value: number) => (perceptron.weights[i] = value),
      })),
      {
        get: () => perceptron.bias,
        set: (value: number) => (perceptron.bias = value),
      },
    ]);
    const expectedSteps = parameters.map(({ get, set }) => {
      const value = get();
      set(value + eps);
      const lossPlus = loss();
      set(value - eps);
      const lossMinus = loss();
      set(value);
      return -service.learnRate * ((lossPlus - lossMinus) / (2 * eps));
    });
    const before = parameters.map(({ get }) => get());

    service.points = [new Point(0.3, 0.8, () => 1)];
    service.train(1);

    parameters.forEach(({ get }, i) =>
      expect(get() - before[i]).toBeCloseTo(expectedSteps[i], 6)
    );
  });

  it('returns the sigmoid output of the multi layer net as activation', () => {
    service.createMultiPerceptron(2, [2, 3, 1]);

    const activation = service.activationSilent([0.2, 0.7]);

    expect(activation).toBeGreaterThan(0);
    expect(activation).toBeLessThan(1);
    expect(service.guessSilent([0.2, 0.7])).toBe(toLabelClass(activation));
  });

  it('returns every layer output without changing the perceptrons', () => {
    service.createMultiPerceptron(2, [3, 1]);
    const [hidden, output] = service.perceptrons;
    const lastGuesses = [...hidden, ...output].map((p) => p.lastGuess);

    const layers = service.layerActivationsSilent([0.2, 0.7]);

    expect(layers.map((layer) => layer.length)).toEqual([3, 1]);
    // the hidden layer sees the inputs scaled to -1..1
    expect(layers[0]).toEqual(
      hidden.map((p) => p.guessSigSilent([0.2 * 2 - 1, 0.7 * 2 - 1]))
    );
    expect(layers[1][0]).toBe(service.activationSilent([0.2, 0.7]));
    expect([...hidden, ...output].map((p) => p.lastGuess)).toEqual(lastGuesses);
  });

  it('replays the current auto learning state to late subscribers', () => {
    service.toggleAutoTraining(true);

    let state: boolean | undefined;
    service.autoLearning$
      .subscribe((enabled) => (state = enabled))
      .unsubscribe();

    expect(state).toBe(true);
    service.toggleAutoTraining(false);
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
