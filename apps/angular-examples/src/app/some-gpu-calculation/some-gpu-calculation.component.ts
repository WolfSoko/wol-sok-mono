import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { ResizedEvent } from '@wolsok/ui-kit';
import {
  GpuAdapterService,
  IKernelFunctionThis,
  IKernelRunShortcut,
} from '@wolsok/utils-gpu-calc';
import { distinctUntilChangedDeepEqualObj } from '@wolsok/utils-operators';

import {
  animationFrameScheduler,
  combineLatest,
  interval,
  Observable,
  of,
  Subscription,
  TimeInterval,
} from 'rxjs';
import {
  debounceTime,
  delay,
  map,
  mergeMap,
  scan,
  startWith,
  timeInterval,
} from 'rxjs/operators';

interface Configuration {
  r: number;
  g: number;
  b: number;
  repetition: number;
  speed: number;
  useGPU: boolean;
}

@Component({
  selector: 'app-some-gpu-calculation',
  templateUrl: './some-gpu-calculation.component.html',
  styleUrls: ['./some-gpu-calculation.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SomeGpuCalculationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gpuCanvasContainer')
  gpuCanvasWrapper!: ElementRef<HTMLDivElement>;

  additionForm!: UntypedFormGroup;
  calculationTime$: Observable<string>;

  private gpuColorizer!: IKernelRunShortcut;
  private subscription?: Subscription;
  dimensionsOfCanvas: [width: number, height: number] = [
    500,
    SomeGpuCalculationComponent.calcHeightOfCanvas(500),
  ];

  constructor(private fb: UntypedFormBuilder, private gpu: GpuAdapterService) {
    this.createForm();

    this.calculationTime$ = interval(500).pipe(
      mergeMap(() => of(performance.getEntriesByName('createCanvasWithGPU'))),
      map((measures: PerformanceEntry[]) => {
        if (measures.length === 0) {
          return 0;
        }
        const result = measures.reduce(
          (acc, next) => acc + next.duration / measures.length,
          0
        );
        if (measures.length > 60) {
          performance.clearMeasures();
          performance.clearMarks();
        }
        return result;
      }),
      startWith(0),
      map((time) => time.toFixed(3))
    );
  }

  private static calcHeightOfCanvas(
    newWidth: number,
    aspectRatio: number = 3 / 4
  ): number {
    return Math.floor(newWidth * aspectRatio);
  }

  async ngAfterViewInit(): Promise<void> {
    await this.createGPUColorizer(this.additionForm.get('useGPU')?.value);
    const config$: Observable<Omit<Configuration, 'useGPU'>> = (
      this.additionForm.valueChanges as Observable<Configuration>
    ).pipe(
      startWith(this.additionForm.value as Configuration),
      map(({ r, g, b, repetition, speed }) => ({ r, g, b, repetition, speed })),
      distinctUntilChangedDeepEqualObj(),
      debounceTime(300)
    );

    const gpuColorizerFrames$ = interval(
      Math.floor(1000 / 120),
      animationFrameScheduler
    ).pipe(
      timeInterval<number>(),
      scan<TimeInterval<number>, number>(
        (acc, value) => acc + value.interval,
        0
      )
    );

    const calculateNextFrame$ = combineLatest([
      gpuColorizerFrames$,
      config$,
    ]).pipe(
      map(([frameTime, { r, g, b, repetition, speed }]) => ({
        frameTime,
        r,
        g,
        b,
        repetition,
        speed,
      }))
    );

    this.subscription = calculateNextFrame$.subscribe((config) => {
      this.calculateNextFrame(config);
    });

    this.subscription.add(
      this.additionForm
        .get('useGPU')
        ?.valueChanges.pipe(delay(0))
        .subscribe(async (useGPU) => await this.createGPUColorizer(useGPU))
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  calculateNextFrame({
    frameTime,
    r,
    g,
    b,
    repetition,
    speed,
  }: {
    frameTime: number;
    r: number;
    g: number;
    b: number;
    repetition: number;
    speed: number;
  }): void {
    const [width, height] = this.dimensionsOfCanvas;
    performance.mark('createCanvasWithGPU-start');
    this.gpuColorizer.canvas.width = width;
    this.gpuColorizer.canvas.height = height;
    this.gpuColorizer.setOutput([width, height]);
    this.gpuColorizer(
      frameTime / 1000,
      r / 255,
      g / 255,
      b / 255,
      repetition,
      speed / 20,
      width,
      height
    );

    performance.mark('createCanvasWithGPU-end');
    performance.measure(
      'createCanvasWithGPU',
      'createCanvasWithGPU-start',
      'createCanvasWithGPU-end'
    );
  }

  private replaceCanvas(canvas: HTMLCanvasElement): void {
    this.gpuCanvasWrapper.nativeElement.replaceChildren(canvas);
  }

  private createForm(): void {
    this.additionForm = this.fb.group({
      r: [255, [Validators.required, Validators.min(0), Validators.max(255)]],
      g: [255, [Validators.required, Validators.min(0), Validators.max(255)]],
      b: [255, [Validators.required, Validators.min(0), Validators.max(255)]],
      repetition: [
        1,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      speed: [
        20,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      useGPU: [true, [Validators.required]],
    });
  }

  private async createGPUColorizer(useGPU: boolean): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = this.dimensionsOfCanvas[0];
    canvas.height = this.dimensionsOfCanvas[1];
    if (useGPU) {
      const gl = canvas.getContext('webgl2', { premultipliedAlpha: false });
      if (!gl) {
        throw new Error('WebGL is not supported');
      }
      await this.gpu.setUseGPU(useGPU, { canvas, context: gl });
    } else {
      await this.gpu.setUseGPU(false, { canvas });
    }

    function colorFn(
      this: IKernelFunctionThis,
      frameTime: number,
      red: number,
      green: number,
      blue: number,
      repetition: number,
      speed: number,
      width: number,
      height: number
    ) {
      const framedSpeed = frameTime * speed;
      const nX = (this.thread.x / width) * repetition;
      const nY = (this.thread.y / height) * repetition;
      const x = nX - Math.floor(nX);
      const y = nY - Math.floor(nY);
      const waveParam0 = framedSpeed + x + 0.5 * y;
      const waveParam1 = framedSpeed + y;
      const waveParam2 = framedSpeed + y / (x + 0.1);

      this.color(
        red * Math.sin(waveParam0),
        green * Math.cos(waveParam1),
        blue * Math.tan(waveParam2),
        Math.random() / 2 + 0.5
      );
    }

    this.gpuColorizer = this.gpu
      .createKernel(colorFn)
      .setGraphical(true)
      .setDynamicOutput(true);

    this.replaceCanvas(this.gpuColorizer.canvas);
  }

  async updateCanvasSize({ newWidth }: ResizedEvent) {
    const canvas: HTMLCanvasElement | null = this.gpuCanvasWrapper.nativeElement
      .firstElementChild as HTMLCanvasElement;
    if (!canvas) {
      return;
    }
    const height: number =
      SomeGpuCalculationComponent.calcHeightOfCanvas(newWidth);
    this.dimensionsOfCanvas = [newWidth, height];
    await this.createGPUColorizer(this.additionForm.get('useGPU')?.value);
  }
}
