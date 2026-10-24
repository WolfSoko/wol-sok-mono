import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, interval, Observable } from 'rxjs';
import { distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Perceptron } from './perceptron';
import { LabelClass, Point, toLabelClass } from './point';
import { TrainData } from './train-data';
import { TrainDataService } from './train-data.service';

const defaultLearnRate = 0.3;
const defaultBackPropagationLearnRate = 1;

export type LabelDefinition = (x: number, y: number) => LabelClass;

export const diagonalLabel: LabelDefinition = (x, y) => (x > y ? 1 : 0);

// provided by NeuralNetworkComponent, so its state and auto learning end with the page
@Injectable()
export class BrainService {
  private trainDataService = inject(TrainDataService);

  private readonly _learnedDataPoints = signal(0);
  points: Point[] = [];
  /** Which class the generated training points belong to. */
  labelDefinition: LabelDefinition = diagonalLabel;
  perceptrons: Perceptron[][] = [[]];
  isSinglePerceptron = false;

  private readonly _learnRate = signal(defaultLearnRate);
  // BehaviorSubject so a settings card created later (e.g. after a tab switch) shows the current state
  private autoLearningSubject = new BehaviorSubject<boolean>(false);

  constructor() {
    this.autoLearning$
      .pipe(
        switchMap((enabled) => (enabled ? interval(50) : EMPTY)),
        takeUntilDestroyed()
      )
      .subscribe(() => this.train());
  }

  public get autoLearning$(): Observable<boolean> {
    return this.autoLearningSubject.pipe(distinctUntilChanged());
  }

  public get learnedDataPoints(): number {
    return this._learnedDataPoints();
  }

  public get learnRate(): number {
    return this._learnRate();
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
    this._learnRate.set(
      this.isSinglePerceptron
        ? defaultLearnRate
        : defaultBackPropagationLearnRate
    );
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
          this._learnRate.set(
            Math.max(
              this.learnRate * (1 - this.learnedDataPoints / 1000),
              0.0005
            )
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
    // cross-entropy loss: the sigmoid derivative cancels out, so a confidently
    // wrong output still gets a large correction instead of a vanishing one
    deltas[lastLayer][0] = trainData.expected - output;
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

  /**
   * Runs the inputs through all layers with sigmoid activation and, unless silent,
   * stores each perceptron's last input and output. A multi layer net gets its
   * inputs scaled from 0..1 to -1..1, so the hidden perceptrons start out unsaturated.
   */
  private feedForward(input: number[], silent = false): number {
    const layers = this.layerOutputs(input, silent);
    // last layer should always be only one output perceptron
    return layers[layers.length - 1][0];
  }

  private layerOutputs(input: number[], silent: boolean): number[][] {
    let layerResult = this.isSinglePerceptron
      ? input
      : input.map((value) => value * 2 - 1);
    return this.perceptrons.map((layer) => {
      const layerInput = layerResult;
      layerResult = layer.map((perceptron) =>
        silent
          ? perceptron.guessSigSilent(layerInput)
          : perceptron.guessSig(layerInput)
      );
      return layerResult;
    });
  }

  /** The output of every perceptron, layer by layer, without changing any perceptron state. */
  public layerActivationsSilent(data: number[]): number[][] {
    return this.layerOutputs(data, true);
  }

  updateTrainingData(): Point[] {
    this.points = this.trainDataService.createTestData(
      100,
      this.labelDefinition
    );
    return this.points;
  }

  toggleAutoTraining(autoTrainingEnabled: boolean) {
    this.autoLearningSubject.next(autoTrainingEnabled);
  }

  addPoint(point: Point) {
    this.points.push(point);
  }

  clearPoints() {
    this.points = [];
  }

  /** The class the network assigns to the given data point. */
  public guessSilent(data: number[]): LabelClass {
    return toLabelClass(this.activationSilent(data));
  }

  /** The network's sigmoid output (0..1) for the given data point, without changing any perceptron state. */
  public activationSilent(data: number[]): number {
    return this.feedForward(data, true);
  }
}
