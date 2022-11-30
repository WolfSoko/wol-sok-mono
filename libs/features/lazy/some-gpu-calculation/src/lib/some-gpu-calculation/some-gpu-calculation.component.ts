import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import {
  ElemResizedDirective,
  ElevateCardDirective,
  ResizedEvent,
  ShowFpsComponent,
} from '@wolsok/ui-kit';
import {
  GpuAdapterService,
  IKernelFunctionThis,
  IKernelRunShortcut,
} from '@wolsok/utils-gpu-calc';
import { MeasureFps } from '@wolsok/utils-measure-fps';
import { distinctUntilChangedDeepEqualObj } from '@wolsok/utils-operators';

import {
  animationFrameScheduler,
  combineLatest,
  interval,
  Observable,
  Subscription,
  TimeInterval,
} from 'rxjs';
import {
  debounceTime,
  delay,
  map,
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
  standalone: true,
  imports: [
    CommonModule,
    ElemResizedDirective,
    ReactiveFormsModule,
    MatSliderModule,
    MatCardModule,
    MatChipsModule,
    MatSlideToggleModule,
    ElevateCardDirective,
    ShowFpsComponent,
  ],
  providers: [{ provide: MeasureFps, useValue: new MeasureFps() }],
  selector: 'lazy-feat-gpu-calc',
  templateUrl: './some-gpu-calculation.component.html',
  styleUrls: ['./some-gpu-calculation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SomeGpuCalculationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gpuCanvasContainer')
  gpuCanvasWrapper!: ElementRef<HTMLDivElement>;

  additionForm!: FormGroup<{
    r: FormControl<number>;
    g: FormControl<number>;
    b: FormControl<number>;
    repetition: FormControl<number>;
    speed: FormControl<number>;
    useGPU: FormControl<boolean>;
  }>;

  calculationTime$: Observable<number>;
  fps$: Observable<number>;

  private gpuColorizer!: IKernelRunShortcut;
  private subscription?: Subscription;
  dimensionsOfCanvas: [width: number, height: number] = [
    500,
    SomeGpuCalculationComponent.calcHeightOfCanvas(500),
  ];

  constructor(
    private fb: FormBuilder,
    private gpu: GpuAdapterService,
    private readonly measureFps: MeasureFps
  ) {
    this.createForm();
    this.calculationTime$ = this.measureFps.frameTimeMs$;
    this.fps$ = this.measureFps.fps$;
  }

  private static calcHeightOfCanvas(
    newWidth: number,
    aspectRatio: number = 9 / 16
  ): number {
    return Math.floor(newWidth * aspectRatio);
  }

  readonly formatSpeed = (value: number) => value + '%';

  async ngAfterViewInit(): Promise<void> {
    await this.createGPUColorizer(this.additionForm.controls.useGPU.value);
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
    this.measureFps.signalFrameReady();
  }

  private replaceCanvas(canvas: HTMLCanvasElement): void {
    this.gpuCanvasWrapper.nativeElement.replaceChildren(canvas);
  }

  private createForm(): void {
    this.additionForm = this.fb.nonNullable.group({
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
    await this.createGPUColorizer(this.additionForm.controls.useGPU.value);
  }
}
