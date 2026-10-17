import { Injectable, inject, signal } from '@angular/core';
import { interval, Observable, Subject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  repeat,
  skipUntil,
  startWith,
  takeUntil,
} from 'rxjs/operators';
import { Perceptron } from './perceptron';
import { LabelClass, Point } from './point';
import { TrainData } from './train-data';
import { TrainDataService } from './train-data.service';

const defaultLearnRate = 0.3;
// sigmoid back propagation needs a much larger step than the perceptron rule
const defaultBackPropagationLearnRate = 3;

@Injectable({ providedIn: 'root' })
export class BrainService {
  private trainDataService = inject(TrainDataService);

  private readonly _learnedDataPoints = signal(0);
  points: Point[] = [];
  perceptrons: Perceptron[][] = [[]];
  isSinglePerceptron = false;

  private readonly _learnRate = signal(defaultLearnRate);
  private autoLearningSubject = new Subject<boolean>();
  private startAutoLearning$ = this.autoLearningSubject.pipe(
    filter((autoLearningEnabled) => autoLearningEnabled)
  );
  private stopAutoLearning$ = this.autoLearningSubject.pipe(
    filter((autoLearningEnabled) => !autoLearningEnabled)
  );

  private autoLearner$ = interval(50).pipe(
    distinctUntilChanged(),
    skipUntil(this.startAutoLearning$),
    takeUntil(this.stopAutoLearning$),
    repeat()
  );

  constructor() {
    this.autoLearner$.subscribe(() => this.train());
  }

  get autoLearning$(): Observable<boolean> {
    return this.autoLearningSubject.asObservable().pipe(startWith(false));
  }

  get learnedDataPoints(): number {
    return this._learnedDataPoints();
  }

  get learnRate(): number {
    return this._learnRate();
  }

  set learnRate(learnRate: number) {
    this._learnRate.set(learnRate);
  }

  createPerceptron(inputDimensions = 2): Perceptron {
    this.createMultiPerceptron(inputDimensions, [1]);
    return this.perceptrons[0][0];
  }

  createMultiPerceptron(
    inputDimensions = 2,
    amountPerceptronsPerLayer: number[] = [3, 1]
  ): Perceptron[][] {
    this._learnedDataPoints.set(0);
    this.isSinglePerceptron = amountPerceptronsPerLayer.length === 1;
    this.learnRate = this.isSinglePerceptron
      ? defaultLearnRate
      : defaultBackPropagationLearnRate;
    this.perceptrons = amountPerceptronsPerLayer.map(
      (amountPerLayer, index) => {
        const layer = [];
        for (let i = 0; i < amountPerLayer; i++) {
          layer.push(
            new Perceptron(
              index > 0 ? amountPerceptronsPerLayer[index - 1] : inputDimensions
            )
          );
        }
        return layer;
      }
    );
    return this.perceptrons;
  }

  train(randomDataPointsToTest = 10) {
    if (this.points.length === 0) {
      return;
    }

    for (let i = 0; i < randomDataPointsToTest; i++) {
      const randomIndex = Math.random() * this.points.length;
      const point = this.points[Math.floor(randomIndex)];
      if (this.isSinglePerceptron) {
        const error = this.perceptrons[0][0].train(
          point.trainData,
          this.learnRate
        );
        if (error !== 0.0) {
          this._learnedDataPoints.update((count) => count + 1);
          this.learnRate = Math.max(
            this.learnRate * (1 - this.learnedDataPoints / 1000),
            0.0005
          );
        }
      } else {
        this.trainWithBackPropagation(point.trainData);
      }
    }
  }

  private trainWithBackPropagation(trainData: TrainData) {
    const output = this.feedForward(trainData.inputs);

    // deltas[l][j] = error term of perceptron j in layer l. All of them are
    // computed from the current weights before any weight is changed.
    const deltas: number[][] = this.perceptrons.map((layer) =>
      layer.map(() => 0)
    );
    const lastLayer = this.perceptrons.length - 1;
    deltas[lastLayer][0] =
      output * (1 - output) * (trainData.expected - output);
    for (let l = lastLayer - 1; l >= 0; l--) {
      const nextLayer = this.perceptrons[l + 1];
      this.perceptrons[l].forEach((perceptron, j) => {
        const downstreamError = nextLayer.reduce(
          (sum, next, k) => sum + deltas[l + 1][k] * next.weights[j],
          0
        );
        deltas[l][j] =
          perceptron.lastGuess * (1 - perceptron.lastGuess) * downstreamError;
      });
    }

    this.perceptrons.forEach((layer, l) =>
      layer.forEach((perceptron, j) =>
        perceptron.trainWithLastInput(deltas[l][j], this.learnRate)
      )
    );
    this._learnedDataPoints.update((count) => count + 1);
  }

  /** Runs the inputs through all layers with sigmoid activation and stores each perceptron's last input and output. */
  private feedForward(input: number[]): number {
    let layerResult = [...input];
    for (const layer of this.perceptrons) {
      layerResult = layer.map((perceptron) => perceptron.guessSig(layerResult));
    }
    // last layer should always be only one output perceptron
    return layerResult[0];
  }

  private feedForwardSilent(input: number[]): number {
    let layerResult = [...input];
    for (const layer of this.perceptrons) {
      layerResult = layer.map((perceptron) =>
        perceptron.guessSigSilent(layerResult)
      );
    }
    return layerResult[0];
  }

  updateTrainingData(): Point[] {
    this.points = this.trainDataService.createTestData(100);
    return this.points;
  }

  guess(input: number[]): number {
    if (this.isSinglePerceptron) {
      return this.perceptrons[0][0].guess(input);
    }
    return this.feedForward(input);
  }

  toggleAutoTraining(autoTrainingEnabled: boolean) {
    this.autoLearningSubject.next(autoTrainingEnabled);
  }

  addPoint(point: Point) {
    this.points.push(point);
    this.guess(point.data);
  }

  clearPoints() {
    this.points = [];
  }

  /** The class the network assigns to the given data point. */
  guessSilent(data: number[]): LabelClass {
    return this.activationSilent(data) < 0.5 ? 0 : 1;
  }

  /** The network's sigmoid output (0..1) for the given data point, without changing any perceptron state. */
  activationSilent(data: number[]): number {
    if (this.isSinglePerceptron) {
      return this.perceptrons[0][0].guessSigSilent(data);
    }
    return this.feedForwardSilent(data);
  }
}
