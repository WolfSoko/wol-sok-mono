import { GPUFunction, IGPUFunctionSettings } from '@wolsok/utils-gpu-calc';

export type ThreadFunctionDefinition = {
  threadFn: GPUFunction;
  settings?: IGPUFunctionSettings;
};
