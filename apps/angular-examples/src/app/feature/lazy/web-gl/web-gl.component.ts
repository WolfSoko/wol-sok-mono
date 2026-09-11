import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import {
  IUniform,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';
import {
  DEFAULT_PRESET,
  FRACTAL_PRESETS,
  FractalPreset,
} from './fractal-presets';
import {
  COLOR_MODES,
  ColorMode,
  ComplexPoint,
  FlightPlan,
  FractalView,
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  PALETTES,
  autoIterations,
  formatComplex,
  formatMagnification,
  magnification,
  needsHighPrecision,
  panByPixels,
  planFlight,
  sampleFlight,
  screenToComplex,
  splitFloat,
  zoomAt,
} from './fractal-view';
import {
  MANDELBROT_FRAGMENT_SHADER,
  MANDELBROT_VERTEX_SHADER,
} from './mandelbrot-shader';

interface ViewStatus {
  readonly magnification: string;
  readonly coordinates: string;
  readonly iterations: number;
  readonly highPrecision: boolean;
}

const MAX_PIXEL_RATIO = 1.5;
const STATUS_INTERVAL_MS = 120;

@Component({
  selector: 'app-web-gl',
  templateUrl: './web-gl.component.html',
  styleUrls: ['./web-gl.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElevateCardDirective,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatTooltipModule,
  ],
})
export class WebGlComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('webGlCanvas');
  private readonly stageRef =
    viewChild.required<ElementRef<HTMLElement>>('stage');

  protected readonly presets = FRACTAL_PRESETS;
  protected readonly palettes = PALETTES;
  protected readonly colorModes = COLOR_MODES;
  protected readonly minIterations = MIN_ITERATIONS;
  protected readonly maxIterations = MAX_ITERATIONS;

  protected readonly presetId = signal(DEFAULT_PRESET.id);
  protected readonly palette = signal(DEFAULT_PRESET.palette ?? 2);
  protected readonly colorMode = signal<ColorMode>(
    DEFAULT_PRESET.colorMode ?? 'smooth'
  );
  protected readonly samples = signal(1);
  protected readonly morph = signal(0);
  protected readonly juliaC = signal<ComplexPoint>({ x: -0.8, y: 0.156 });
  protected readonly density = signal(DEFAULT_PRESET.density ?? 1.8);
  protected readonly cycleColors = signal(false);
  protected readonly useAutoIterations = signal(true);
  protected readonly manualIterations = signal(400);
  protected readonly pickJuliaC = signal(false);
  protected readonly fps = signal(0);
  protected readonly status = signal<ViewStatus>({
    magnification: '1',
    coordinates: '',
    iterations: autoIterations(DEFAULT_PRESET.view.scale),
    highPrecision: false,
  });

  protected readonly presetHint = computed(
    () =>
      FRACTAL_PRESETS.find((preset) => preset.id === this.presetId())?.hint ??
      ''
  );

  protected readonly juliaLabel = computed(() => {
    const { x, y } = this.juliaC();
    const sign = y < 0 ? '-' : '+';
    return `${x.toFixed(4)} ${sign} ${Math.abs(y).toFixed(4)}i`;
  });

  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: OrthographicCamera;
  private material?: ShaderMaterial;
  private uniforms!: Record<string, IUniform>;
  private resizeObserver?: ResizeObserver;
  private readonly listeners = new AbortController();
  private animationFrame = 0;

  private view: FractalView = DEFAULT_PRESET.view;
  private dirty = true;
  private highPrecision = false;
  private flight?: { plan: FlightPlan; startedAt: number };
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private frameCount = 0;
  private fpsWindowStart = 0;
  private lastStatusAt = 0;

  constructor() {
    effect(() => {
      // Read every control up front so the effect keeps tracking them even
      // before the renderer exists.
      const controls = {
        palette: this.palette(),
        colorMode: this.colorMode(),
        samples: this.samples(),
        morph: this.morph(),
        juliaC: this.juliaC(),
        density: this.density(),
        iterations: this.useAutoIterations() ? null : this.manualIterations(),
      };
      if (!this.material) {
        return;
      }
      this.uniforms['uPalette'].value = controls.palette;
      this.uniforms['uColorMode'].value = COLOR_MODES.indexOf(
        controls.colorMode
      );
      this.uniforms['uSamples'].value = controls.samples;
      this.uniforms['uMorph'].value = controls.morph;
      (this.uniforms['uJuliaC'].value as Vector2).set(
        controls.juliaC.x,
        controls.juliaC.y
      );
      this.uniforms['uDensity'].value = controls.density;
      this.uniforms['uMaxIter'].value =
        controls.iterations ?? autoIterations(this.view.scale);
      this.dirty = true;
    });
  }

  public ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;

    // preserveDrawingBuffer keeps the framebuffer readable for saveImage().
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(
      Math.min(globalThis.devicePixelRatio ?? 1, MAX_PIXEL_RATIO)
    );

    this.uniforms = {
      uCenterX: { value: new Vector2() },
      uCenterY: { value: new Vector2() },
      uScale: { value: new Vector2() },
      uJuliaC: { value: new Vector2(this.juliaC().x, this.juliaC().y) },
      uResolution: { value: new Vector2(1, 1) },
      uAspect: { value: 1 },
      uMaxIter: { value: autoIterations(this.view.scale) },
      uMorph: { value: this.morph() },
      uDensity: { value: this.density() },
      uShift: { value: 0 },
      uPixelSize: { value: 1 },
      uSamples: { value: this.samples() },
      uColorMode: { value: COLOR_MODES.indexOf(this.colorMode()) },
      uPalette: { value: this.palette() },
    };

    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: MANDELBROT_VERTEX_SHADER,
      fragmentShader: MANDELBROT_FRAGMENT_SHADER,
      defines: { EMULATE_DOUBLE: 0 },
      depthTest: false,
      depthWrite: false,
    });

    this.scene = new Scene();
    this.scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.registerInteractions(canvas);
    this.resizeObserver = new ResizeObserver(() => (this.dirty = true));
    this.resizeObserver.observe(this.stageRef().nativeElement);

    this.applyView(this.view);
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  public ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.listeners.abort();
    this.resizeObserver?.disconnect();
    this.material?.dispose();
    this.scene?.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
      }
    });
    this.renderer?.dispose();
  }

  protected onPresetChange(id: string): void {
    const preset = this.presets.find((entry) => entry.id === id);
    if (preset) {
      this.presetId.set(preset.id);
      this.flyTo(preset);
    }
  }

  protected resetView(): void {
    this.onPresetChange(DEFAULT_PRESET.id);
  }

  protected zoomBy(factor: number): void {
    this.cancelFlight();
    this.applyView(
      zoomAt(this.view, factor, { x: this.view.centerX, y: this.view.centerY })
    );
  }

  protected setSamples(samples: number): void {
    this.samples.set(samples);
  }

  protected setIterations(value: number): void {
    this.manualIterations.set(value);
  }

  /** Enabling the picker only makes sense with some Julia mix dialled in. */
  protected togglePickJuliaC(enabled: boolean): void {
    this.pickJuliaC.set(enabled);
    if (enabled && this.morph() === 0) {
      this.morph.set(1);
    }
  }

  protected toggleAutoIterations(auto: boolean): void {
    if (!auto) {
      this.manualIterations.set(autoIterations(this.view.scale));
    }
    this.useAutoIterations.set(auto);
  }

  protected toggleFullscreen(): void {
    const stage = this.stageRef().nativeElement;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stage.requestFullscreen?.();
    }
  }

  /** Renders once more and hands the framebuffer to the browser as a PNG. */
  protected saveImage(): void {
    const canvas = this.canvasRef().nativeElement;
    this.renderScene();
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mandelbrot-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  private flyTo(preset: FractalPreset): void {
    if (preset.palette != null) {
      this.palette.set(preset.palette);
    }
    if (preset.colorMode) {
      this.colorMode.set(preset.colorMode);
    }
    if (preset.juliaC) {
      this.juliaC.set(preset.juliaC);
    }
    if (preset.morph != null) {
      this.morph.set(preset.morph);
    }
    if (preset.density != null) {
      this.density.set(preset.density);
    }
    this.flight = {
      plan: planFlight(this.view, preset.view),
      startedAt: performance.now(),
    };
  }

  private cancelFlight(): void {
    this.flight = undefined;
  }

  private registerInteractions(canvas: HTMLCanvasElement): void {
    const options = { signal: this.listeners.signal };

    canvas.addEventListener(
      'pointerdown',
      (event: PointerEvent) => {
        if (this.pickJuliaC()) {
          return;
        }
        canvas.setPointerCapture(event.pointerId);
        this.cancelFlight();
        this.pointers.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        this.pinchDistance = this.currentPinchDistance();
      },
      options
    );

    canvas.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        if (this.pickJuliaC()) {
          this.juliaC.set(this.complexAt(event.clientX, event.clientY));
          return;
        }
        const previous = this.pointers.get(event.pointerId);
        if (!previous) {
          return;
        }
        this.pointers.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });

        if (this.pointers.size === 1) {
          this.applyView(
            panByPixels(
              this.view,
              event.clientX - previous.x,
              event.clientY - previous.y,
              canvas.clientHeight
            )
          );
          return;
        }

        const distance = this.currentPinchDistance();
        if (this.pinchDistance > 0 && distance > 0) {
          const midpoint = this.pinchMidpoint();
          this.zoomAtClient(
            midpoint.x,
            midpoint.y,
            this.pinchDistance / distance
          );
        }
        this.pinchDistance = distance;
      },
      options
    );

    const releasePointer = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId);
      this.pinchDistance = this.currentPinchDistance();
    };
    canvas.addEventListener('pointerup', releasePointer, options);
    canvas.addEventListener('pointercancel', releasePointer, options);
    canvas.addEventListener('lostpointercapture', releasePointer, options);

    canvas.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        event.preventDefault();
        this.cancelFlight();
        // deltaMode 1 reports lines instead of pixels.
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
        const factor = Math.exp(Math.max(-4, Math.min(4, delta * 0.0016)));
        this.zoomAtClient(event.clientX, event.clientY, factor);
      },
      { ...options, passive: false }
    );

    canvas.addEventListener(
      'dblclick',
      (event: MouseEvent) => {
        this.cancelFlight();
        this.zoomAtClient(event.clientX, event.clientY, 0.4);
      },
      options
    );
  }

  private currentPinchDistance(): number {
    if (this.pointers.size !== 2) {
      return 0;
    }
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pinchMidpoint(): { x: number; y: number } {
    const [a, b] = [...this.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private complexAt(clientX: number, clientY: number): ComplexPoint {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    return screenToComplex(
      this.view,
      clientX - rect.left,
      clientY - rect.top,
      rect.width,
      rect.height
    );
  }

  private zoomAtClient(clientX: number, clientY: number, factor: number): void {
    this.applyView(zoomAt(this.view, factor, this.complexAt(clientX, clientY)));
  }

  private applyView(view: FractalView): void {
    this.view = view;
    this.dirty = true;

    const [centerXHigh, centerXLow] = splitFloat(view.centerX);
    const [centerYHigh, centerYLow] = splitFloat(view.centerY);
    const [scaleHigh, scaleLow] = splitFloat(view.scale);
    (this.uniforms['uCenterX'].value as Vector2).set(centerXHigh, centerXLow);
    (this.uniforms['uCenterY'].value as Vector2).set(centerYHigh, centerYLow);
    (this.uniforms['uScale'].value as Vector2).set(scaleHigh, scaleLow);

    const iterations = this.useAutoIterations()
      ? autoIterations(view.scale)
      : this.manualIterations();
    this.uniforms['uMaxIter'].value = iterations;

    const wantsHighPrecision = needsHighPrecision(view.scale);
    if (wantsHighPrecision !== this.highPrecision && this.material) {
      this.highPrecision = wantsHighPrecision;
      this.material.defines = { EMULATE_DOUBLE: wantsHighPrecision ? 1 : 0 };
      this.material.needsUpdate = true;
    }
  }

  private readonly renderFrame = (time: number): void => {
    this.animationFrame = requestAnimationFrame(this.renderFrame);

    this.advanceFlight(time);
    this.resize();

    if (this.cycleColors()) {
      this.uniforms['uShift'].value = (time * 0.00006) % 1;
      this.dirty = true;
    }

    if (this.dirty) {
      this.renderScene();
      this.dirty = false;
      this.frameCount++;
    }

    this.trackFps(time);
    this.publishStatus(time);
  };

  private advanceFlight(time: number): void {
    const flight = this.flight;
    if (!flight) {
      return;
    }
    const progress = (time - flight.startedAt) / flight.plan.durationMs;
    this.applyView(sampleFlight(flight.plan, progress));
    if (progress >= 1) {
      this.flight = undefined;
    }
  }

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    const width = Math.max(1, Math.floor(canvas.clientWidth));
    const height = Math.max(1, Math.floor(canvas.clientHeight));
    if (width === this.canvasWidth && height === this.canvasHeight) {
      return;
    }
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.renderer?.setSize(width, height, false);
    this.uniforms['uAspect'].value = width / height;
    (this.uniforms['uResolution'].value as Vector2).set(
      canvas.width,
      canvas.height
    );
    this.dirty = true;
  }

  private renderScene(): void {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.uniforms['uPixelSize'].value =
      (2 * this.view.scale) / Math.max(1, this.canvasHeight);
    this.renderer.render(this.scene, this.camera);
  }

  private trackFps(time: number): void {
    if (this.fpsWindowStart === 0) {
      this.fpsWindowStart = time;
      return;
    }
    const elapsed = time - this.fpsWindowStart;
    if (elapsed < 500) {
      return;
    }
    this.fps.set(Math.round((this.frameCount * 1000) / elapsed));
    this.frameCount = 0;
    this.fpsWindowStart = time;
  }

  private publishStatus(time: number): void {
    if (time - this.lastStatusAt < STATUS_INTERVAL_MS) {
      return;
    }
    this.lastStatusAt = time;
    const next: ViewStatus = {
      magnification: formatMagnification(magnification(this.view)),
      coordinates: formatComplex(
        this.view.centerX,
        this.view.centerY,
        this.view.scale
      ),
      iterations: this.uniforms['uMaxIter'].value as number,
      highPrecision: this.highPrecision,
    };
    const current = this.status();
    if (
      current.magnification !== next.magnification ||
      current.coordinates !== next.coordinates ||
      current.iterations !== next.iterations ||
      current.highPrecision !== next.highPrecision
    ) {
      this.status.set(next);
    }
  }
}
