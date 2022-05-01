import type {
  IConstantsThis,
  IKernelFunctionThis,
  KernelFunction,
  ThreadFunction,
} from '@wolsok/utils-gpu-calc';
import { KernelDefinition } from './kernel.definition';
import { ThreadFunctionDefinition } from './thread-function.definition';

export interface CalcNextGridKernelConstants extends IConstantsThis {
  width: number;
  height: number;
}

type CalcNextGridKernelThis = IKernelFunctionThis<CalcNextGridKernelConstants>;

const usedFunctions: ThreadFunctionDefinition[] = [];

function limit(value: number, lowLim: number, highLim: number): number {
  return Math.max(Math.min(value, highLim), lowLim);
}

usedFunctions.push({
  threadFn: limit as ThreadFunction,
});

function smoothy(lowLim: number, highLim: number, value: number): number {
  const smoothedValue: number = (value - lowLim) / (highLim - lowLim);
  return limit(smoothedValue, 0.0, 1.0);
}

usedFunctions.push({
  threadFn: smoothy as ThreadFunction,
});

function wrapAround(index: number, limit: number): number {
  return (index + limit) % limit;
}

usedFunctions.push({
  threadFn: wrapAround as ThreadFunction,
  settings: {
    argumentTypes: ['Number', 'Number'],
    returnType: 'Integer',
  },
});

function cellVal(
  grid: number[][][],
  fluidAOrB: number,
  columnOffset: number,
  rowOffset: number,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const indexX = x + columnOffset;
  const indexY = y + rowOffset;
  const xIndex = wrapAround(indexX, width);
  const yIndex = wrapAround(indexY, height);
  return grid[fluidAOrB][yIndex][xIndex];
}

usedFunctions.push({
  threadFn: cellVal as ThreadFunction,
});

function calcWeightedSum(
  grid: number[][][],
  fluid: number,
  weights: number[],
  x: number,
  y: number,
  width: number,
  height: number
): number {
  let result = 0.0;
  let wIndex = 0;
  for (let dX = 1; dX > -2; dX--) {
    for (let dY = -1; dY < 2; dY++) {
      const weightOfCell: number = weights[wIndex];
      const cellValue = cellVal(grid, fluid, dX, dY, x, y, width, height);
      result = result + cellValue * weightOfCell;
      wIndex++;
    }
  }
  return result;
}

usedFunctions.push({
  threadFn: calcWeightedSum as ThreadFunction,
});

function calcNextA(
  a: number,
  dA: number,
  laplaceA: number,
  abb: number,
  f: number
): number {
  return a + dA * laplaceA - abb + f * (1.0 - a);
}

usedFunctions.push({
  threadFn: calcNextA as ThreadFunction,
});

function calcFluidBToAdd(
  grid: number[][][],
  x: number,
  y: number,
  radius: number,
  threadX: number,
  threadY: number,
  height: number
): number {
  const i = Math.abs(x - threadX);
  const j = Math.abs(y - (height - threadY));
  const radPos = i * i + j * j;

  // radius² >= radPos.
  const fluidBToAdd = smoothy(radius * radius, 0.0, radPos);
  return limit(fluidBToAdd, 0.0, 1.0);
}

usedFunctions.push({
  threadFn: calcFluidBToAdd as ThreadFunction,
});

function calcNextKernel(
  this: CalcNextGridKernelThis,
  grid: number[][][],
  weights: number[],
  calcParams: [
    dA: number,
    dB: number,
    f: number,
    k: number,
    dynkillfeed: number
  ],
  addChemicalsParams: [
    xAdd: number,
    yAdd: number,
    radius: number,
    addChems: number
  ]
): number {
  const [dA, dB, f, k, dynkillfeed] = calcParams;
  const [xAdd, yAdd, radius, addChems] = addChemicalsParams;

  const xNormed: number = this.thread.x / this.constants.width;
  const yNormed: number = this.thread.y / this.constants.height;

  const fluidA = grid[0][this.thread.y][this.thread.x];
  let fluidB = grid[1][this.thread.y][this.thread.x];
  const isFluidA = 1.0 - this.thread.z;
  const isFluidB = this.thread.z;

  const isCalcFluidBToAdd = addChems * isFluidB;
  fluidB +=
    isCalcFluidBToAdd *
    calcFluidBToAdd(
      grid,
      xAdd,
      yAdd,
      radius,
      this.thread.x,
      this.thread.y,
      this.constants.height
    );

  // we calculate k and f depending on x, y when dynkillfeed = 1
  const kT = k * (1.0 - dynkillfeed) + (k + xNormed * 0.025) * dynkillfeed;
  const fT =
    f * (1.0 - dynkillfeed) + (f + 0.09 + yNormed * -0.09) * dynkillfeed;

  const abb: number = fluidA * fluidB * fluidB;

  const laplaceA: number =
    isFluidA *
    calcWeightedSum(
      grid,
      0,
      weights,
      this.thread.x,
      this.thread.y,
      this.constants.width,
      this.constants.height
    );

  let result =
    isFluidA * limit(calcNextA(fluidA, dA, laplaceA, abb, fT), 0.0, 1.0);

  const laplaceB: number =
    isFluidB *
    calcWeightedSum(
      grid,
      1,
      weights,
      this.thread.x,
      this.thread.y,
      this.constants.width,
      this.constants.height
    );
  const fB: number = fluidB + dB * laplaceB + abb - (kT + fT) * fluidB;
  result += isFluidB * limit(fB, 0.0, 1.0);
  return result;
}

export type CalcNextGridKernelParams = Parameters<typeof calcNextKernel>;

export const calcNextKernelModule: KernelDefinition<
  CalcNextGridKernelParams,
  CalcNextGridKernelConstants
> = {
  kernel: calcNextKernel as KernelFunction,
  threadFunctions: usedFunctions,
};
