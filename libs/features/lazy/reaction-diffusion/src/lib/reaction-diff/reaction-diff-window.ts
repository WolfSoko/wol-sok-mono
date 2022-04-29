import { IGPUFunctionSettings, KernelFunction, ThreadFunction } from 'gpu.js';

export interface ReactionDiffKernelModules {
  calcNextKernelModule: {
    calcNextKernel: KernelFunction<
      [
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
      ]
    >;
    usedFunctions: ThreadFunction[];
    usedFunctionTypes: [IGPUFunctionSettings];
  };
  imageKernelModule: {
    imageKernel: KernelFunction;
    usedFunctions: ThreadFunction[];
  };
}
