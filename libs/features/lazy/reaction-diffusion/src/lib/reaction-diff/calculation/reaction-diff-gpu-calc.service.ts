import { calcNextKernelModule, imageKernelModule } from '@wolsok/feat-shared-reaction-diffusion-kernels';
import {
  GpuAdapterService,
  IKernelRunShortcut,
  IKernelRunShortcutBase,
  Texture,
  IKernelFunctionThis,
} from '@wolsok/utils-gpu-calc';
import { Observable } from 'rxjs';
import { CellWeights, weightsToArray } from '../cell-weights-to-array';
import { ReactionDiffCalcParams } from './reaction-diff-calc-params';
import { ReactionDiffCalculator } from './reaction-diff-calculator';

export class ReactionDiffGpuCalcService implements ReactionDiffCalculator {
  numberThreads = 1;
  private lastNextCalc = 0;
  private weights?: number[];
  private addChemicalRadius = 1;
  private calcNextKernels: {
    first: IKernelRunShortcutBase<Texture>;
    second: IKernelRunShortcutBase<Texture>;
  } | null = null;
  private speed = 1;
  private imageKernel: IKernelRunShortcut | null = null;
  private calcParams?: ReactionDiffCalcParams;
  private nextAddChemicals: [number, number, number, number] = [0, 0, 0, 0];
  private nextImage: HTMLCanvasElement | null = null;
  private initGridKernel?: IKernelRunShortcut | null;
  private initialized = false;
  private grid?: Texture;

  constructor(
    private width: number,
    private height: number,
    calcParams$: Observable<ReactionDiffCalcParams>,
    calcCellWeights$: Observable<CellWeights>,
    addChemicalRadius$: Observable<number>,
    speed$: Observable<number>,
    private gpuJs: GpuAdapterService
  ) {
    this.gpuJs.setUseGPU(true).then(() => {
      calcParams$.subscribe((calcParams) => {
        this.setCalcParams(calcParams);
      });
      calcCellWeights$.subscribe((weights) => this.setWeights(weights));
      addChemicalRadius$.subscribe((radius) => (this.addChemicalRadius = radius));
      speed$.subscribe((speed) => (this.speed = speed));
      this.init();
    });
  }

  reset(): void {
    this.initGrid();
    this.addChemical(this.width / 2, this.height / 2);
  }

  addChemical(x: number, y: number): void {
    const r = this.addChemicalRadius;
    if (r != null) {
      this.nextAddChemicals = [x, y, r, 1.0];
      this.calcNext(1);
    }
  }

  resize(width: number, height: number): void {
    this.initialized = false;
    this.width = width;
    this.height = height;
    (this.grid as Texture).delete();
    this.initGridKernel = null;
    this.init();
  }

  calcNext(repeat: number = this.speed): void {
    if (!(this.calcParams && this.calcNextKernels)) {
      throw new Error('calcParams or calcNextKernels not initialized');
    }
    const calcParams = [
      this.calcParams.diffRateA,
      this.calcParams.diffRateB,
      this.calcParams.feedRate,
      this.calcParams.killRate,
      this.calcParams.dynamicKillFeed ? 1 : 0,
    ];

    for (let i = 0; i < repeat; i++) {
      // using texture swap to prevent input texture == output texture webGl error;
      const calcKernel = this.lastNextCalc === 0 ? this.calcNextKernels.first : this.calcNextKernels.second;
      const oldGrid: Texture | undefined = this.grid;
      this.grid = calcKernel(oldGrid, this.weights, calcParams, this.nextAddChemicals);
      oldGrid?.delete();
      this.lastNextCalc = (this.lastNextCalc + 1) % 2;
      this.nextAddChemicals = [0, 0, 0, 0];
    }
  }

  initGrid() {
    if (!this.initGridKernel) {
      this.initGridKernel = this.gpuJs
        .createKernel(function initGrid(this: IKernelFunctionThis) {
          return 1.0 - (this.thread.z % 2);
        })
        .setOutput([this.width, this.height, 2])
        .setImmutable(true)
        .setPipeline(true);
    }
    this.grid = this.initGridKernel() as Texture;
  }

  drawImage(p: { canvas: HTMLCanvasElement }): void {
    if (!this.initialized) {
      return;
    }
    if (!this.grid) {
      this.calcNext(1);
      return;
    }
    this.imageKernel?.(this.grid);
    this.nextImage = this.imageKernel?.canvas;
    const context = p.canvas.getContext('2d');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (this.nextImage) {
      context?.drawImage(
        this.nextImage,
        0,
        this.nextImage.height - this.height,
        this.width,
        this.height,
        0,
        0,
        this.width,
        this.height
      );
    }
  }

  cleanup() {
    this.initialized = false;
    this.grid?.delete();
    this.calcNextKernels?.first?.destroy();
    this.calcNextKernels?.second?.destroy();
    this.calcNextKernels = null;
    this.initGridKernel?.destroy();
    this.initGridKernel = null;
    this.imageKernel?.destroy();
    this.imageKernel = null;
    this.lastNextCalc = 0;
    this.nextImage = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateNumberThreads(numberWebWorkers: number): void {
    // nothing to do here.
  }

  private init() {
    this.initGrid();

    const first = this.createCalcNextGpuKernel();
    const second = this.createCalcNextGpuKernel();
    this.calcNextKernels = {
      first,
      second,
    };
    this.imageKernel = this.createImageKernel();
    this.addChemical(this.width / 2, this.height / 2);
    this.initialized = true;
  }

  private setWeights(weights: CellWeights) {
    this.weights = weightsToArray(weights);
  }

  private setCalcParams(calcParams: ReactionDiffCalcParams) {
    this.calcParams = calcParams;
  }

  private createCalcNextGpuKernel(): IKernelRunShortcutBase<Texture> {
    const pipeline: IKernelRunShortcutBase<Texture> = this.gpuJs
      .createKernel(calcNextKernelModule.kernel, {
        output: [this.width, this.height, 2],
        pipeline: true,
        constants: {
          width: this.width,
          height: this.height,
        },
      })
      .setImmutable(true) as IKernelRunShortcutBase<Texture>;

    calcNextKernelModule.threadFunctions.forEach(({ settings, threadFn }) => {
      pipeline.addFunction(threadFn, settings);
    });

    return pipeline;
  }

  private createImageKernel(): IKernelRunShortcut {
    const kernel: IKernelRunShortcutBase = this.gpuJs
      .createKernel(imageKernelModule.kernel)
      .setOutput([this.width, this.height]);
    imageKernelModule.threadFunctions.forEach(({ threadFn, settings }) => {
      kernel.addFunction(threadFn, settings);
    });
    return kernel.setGraphical(true);
  }
}
