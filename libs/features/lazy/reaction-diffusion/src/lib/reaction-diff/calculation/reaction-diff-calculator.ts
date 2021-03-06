import P5 from 'p5';

export interface ReactionDiffCalculator {
  numberThreads: number;

  reset(): void;

  addChemical(x: number, y: number): void;

  resize(width: number, height: number): void;

  updateNumberThreads(numberWebWorkers: number): void;

  calcNext(): void;

  drawImage(p: P5 | { canvas: HTMLCanvasElement }): void;

  cleanup(): void;
}
