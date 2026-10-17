import { TrainData } from './train-data';
import { LabelClass, toLabelClass } from './point';

export class Perceptron {
  weights: number[];
  // random like the weights, so the perceptrons of one layer start out different
  bias = Math.random() * 2 - 1;
  lastGuess = 0;
  lastInput: number[] = [];

  private static getRandomWeights(inputConnections: number) {
    const result = [];
    for (let i = 0; i < inputConnections; i++) {
      result.push(Math.random() * 2 - 1.0);
    }
    return result;
  }

  constructor(private inputConnections: number) {
    this.weights = Perceptron.getRandomWeights(inputConnections);
  }

  guessSilent(inputs: number[]): LabelClass {
    return toLabelClass(this.guessSigSilent(inputs));
  }

  guessSigSilent(inputs: number[]): number {
    const weightedSum = inputs.reduce(
      (prev, input, index) => prev + input * this.weights[index],
      this.bias
    );
    return 1 / (1 + Math.exp(-weightedSum));
  }

  guessSig(inputs: number[]): number {
    this.lastGuess = this.guessSigSilent(inputs);
    this.lastInput = [...inputs];
    return this.lastGuess;
  }

  train({ inputs, expected }: TrainData, learnRate: number): number {
    const guess = this.guessSilent(inputs);
    const error = expected - guess;

    if (error !== 0.0) {
      const adjustedWeights = this.weights.map(
        (weight, index) => weight + error * inputs[index] * learnRate
      );

      this.bias = this.bias + error * learnRate;
      this.weights = adjustedWeights;
    }
    return error;
  }

  trainWithLastInput(error: number, learnRate: number): number {
    if (error !== 0.0) {
      const adjustedWeights = this.weights.map(
        (weight, index) => weight + error * this.lastInput[index] * learnRate
      );

      this.bias = this.bias + error * learnRate;
      this.weights = adjustedWeights;
    }
    return error;
  }

  get classSeparatorLine():
    | { x0: number; y0: number; x1: number; y1: number }
    | undefined {
    if (this.inputConnections !== 2) {
      return undefined;
    }
    const y0 = this.bias / -this.weights[1];
    const y1 = (this.weights[0] + this.bias) / -this.weights[1];

    return { x0: 0, y0, x1: 0, y1 };
  }
}
