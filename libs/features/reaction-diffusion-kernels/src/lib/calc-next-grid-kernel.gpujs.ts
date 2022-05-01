import type {
  IConstantsThis,
  IKernelFunctionThis,
  KernelFunction,
  ThreadFunction,
} from '@wolsok/utils-gpu-calc';

export interface CalcNextGridConstants extends IConstantsThis {
  width: number;
  height: number;
}

export type CalcNextGridKernelThis = IKernelFunctionThis<CalcNextGridConstants>;

const usedFunctions: ThreadFunction[] = [];

function limit(value: number, lowLim: number, highLim: number): number {
  return Math.max(Math.min(value, highLim), lowLim);
}

usedFunctions.push(limit as ThreadFunction);

function smoothy(lowLim: number, highLim: number, value: number): number {
  const smoothedValue: number = (value - lowLim) / (highLim - lowLim);
  return limit(smoothedValue, 0.0, 1.0);
}

usedFunctions.push(smoothy as ThreadFunction);

function wrapAround(index: number, limit: number): number {
  if (index >= limit) {
    return index - limit;
  }
  if (index < 0) {
    return limit + index;
  }
  return index;
}

usedFunctions.push(wrapAround as ThreadFunction);

function cellVal(
  grid: number[][][],
  fluid: number,
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
  return grid[fluid][yIndex][xIndex];
}

usedFunctions.push(cellVal as ThreadFunction);

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
      result +=
        cellVal(grid, fluid, dX, dY, x, y, width, height) * weights[wIndex];
      wIndex++;
    }
  }
  return result;
}

usedFunctions.push(calcWeightedSum as ThreadFunction);

function calcNextA(
  a: number,
  dA: number,
  laplaceA: number,
  abb: number,
  f: number
): number {
  return a + dA * laplaceA - abb + f * (1.0 - a);
}

usedFunctions.push(calcNextA as ThreadFunction);

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
  const fluidBToAdd = smoothy(radius * radius, 0, radPos);
  return limit(fluidBToAdd, 0.0, 1.0);
}

usedFunctions.push(calcFluidBToAdd as ThreadFunction);

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

  const { x: tX, y: tY, z: fluid } = this.thread;
  const xNormed: number = tX / this.constants.width;
  const yNormed: number = tY / this.constants.height;

  const fluidA = grid[0][tY][tX];
  let fluidB = grid[1][tY][tX];
  const isFluidA: number = 1.0 - fluid;
  const isFluidB = fluid;

  if (addChems > 0 && isFluidB > 0.0) {
    fluidB += calcFluidBToAdd(
      grid,
      xAdd,
      yAdd,
      radius,
      tX,
      tY,
      this.constants.height
    );
  }

  // we calculate k and f depending on x, y when dynkillfeed = 1
  const kT: number =
    k * (1.0 - dynkillfeed) + (k + xNormed * 0.025) * dynkillfeed;
  const fT: number =
    f * (1.0 - dynkillfeed) + (f + 0.09 + yNormed * -0.09) * dynkillfeed;

  const abb: number = fluidA * fluidB * fluidB;

  if (isFluidA > 0.0) {
    const laplaceA: number = calcWeightedSum(
      grid,
      0,
      weights,
      tX,
      tY,
      this.constants.width,
      this.constants.height
    );
    return limit(calcNextA(fluidA, dA, laplaceA, abb, fT), 0.0, 1.0);
  }
  if (isFluidB > 0.0) {
    const laplaceB: number = calcWeightedSum(
      grid,
      1,
      weights,
      tX,
      tY,
      this.constants.width,
      this.constants.height
    );
    const fB: number = fluidB + dB * laplaceB + abb - (kT + fT) * fluidB;
    return limit(fB, 0.0, 1.0);
  }
  return fluid;
}

export type CalcNextGridKernelParams = Parameters<typeof calcNextKernel>;
export type CalcNextGridKernelType = KernelFunction<
  CalcNextGridKernelParams,
  CalcNextGridConstants
>;

export const calcNextKernelModule: {
  usedFunctions: ThreadFunction[];
  calcNextKernel: CalcNextGridKernelType;
} = {
  usedFunctions,
  calcNextKernel,
};
