import type { IGPUKernelSettings, KernelFunction } from '@wolsok/utils-gpu-calc';
import { ThreadKernelVariable } from 'gpu.js';
import { ThreadFunctionDefinition } from './thread-function.definition';

export type KernelDefinition<
  ArgT extends ThreadKernelVariable[] = ThreadKernelVariable[],
  ConstantsT = Record<string, ThreadKernelVariable>
> = {
  kernel: KernelFunction<ArgT, ConstantsT>;
  settings?: IGPUKernelSettings;
  threadFunctions: ThreadFunctionDefinition[];
};
