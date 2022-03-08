import { Injectable } from '@angular/core';
import {
  GPU,
  GPUFunction,
  IConstantsThis,
  IGPUFunctionSettings,
  IGPUKernelSettings,
  IGPUSettings,
  IKernelRunShortcut,
  IKernelRunShortcutBase,
  KernelFunction,
  KernelOutput,
  ThreadKernelVariable,
} from 'gpu.js';

@Injectable()
export class GpuJsService {
  private delegateGPU: GPU;

  constructor() {
    const mode = 'gpu';
    this.delegateGPU = new GPU({ mode });
  }

  createKernel<
    ArgTypes extends ThreadKernelVariable[],
    ConstantsT extends IConstantsThis = Record<string, never>,
    KernelReturnType extends KernelOutput = KernelOutput
  >(
    kernel: KernelFunction<ArgTypes, ConstantsT>,
    settings?: IGPUKernelSettings
  ): ((...args: ArgTypes) => KernelReturnType) &
    IKernelRunShortcutBase<KernelReturnType> {
    return this.delegateGPU.createKernel(kernel, settings) as ((
      ...args: ArgTypes
    ) => KernelReturnType) &
      IKernelRunShortcutBase<KernelReturnType>;
  }

  setUseGPU(
    useGPU: boolean = true,
    settings?: Partial<IGPUSettings>
  ): GpuJsService {
    this.delegateGPU = new GPU({ mode: useGPU ? 'gpu' : 'cpu', ...settings });
    return this;
  }

  addFunction(
    kernelFunction: GPUFunction,
    settings?: IGPUFunctionSettings
  ): GpuJsService {
    this.delegateGPU.addFunction(kernelFunction, settings);
    return this;
  }

  createCombinedKernel(...kernels: KernelFunction[]): IKernelRunShortcut {
    return this.delegateGPU.combineKernels(...kernels);
  }
}
