import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { MeasureFps } from '@wolsok/utils-measure-fps';
import {
  FragCode,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  u1f,
  u2f,
  Uniform1f,
  Uniform2f,
  VertCode,
  WebGl2Renderer,
} from '@wolsok/ws-gl';

import { Observable, sampleTime } from 'rxjs';

import { ShowFpsComponent } from '../show-fps/show-fps.component';
import defaultVertexShader from './default-vertex-shader.vert';
import {
  bufferSize,
  isSoftwareRenderer,
  rendererName,
  shouldDraw,
} from './render-pacing';

/** A full-screen quad has no edges to smooth. */
const CONTEXT_ATTRIBUTES: WebGLContextAttributes & { antialias: boolean } = {
  antialias: false,
};

@Component({
  selector: 'ws-shared-ui-render-shader',
  templateUrl: './render-shader.component.html',
  styleUrls: ['./render-shader.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MeasureFps, useValue: new MeasureFps() }],
  imports: [CommonModule, ShowFpsComponent],
})
export class RenderShaderComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  private readonly measureFps = inject(MeasureFps);

  @Input() shaderCode!: FragCode;
  @Input() vertexShader!: VertCode;
  @Input() runAnimation: boolean | null = true;
  @Input() showFps = false;
  @Input() canvasWidth!: number;
  @Input() canvasHeight!: number;
  /**
   * The part of the CSS size the shader draws at, scaled up by the browser:
   * a soft shader looks alike at a half and costs a quarter of the pixels.
   */
  @Input() resolutionScale = 1;
  /** At most this many frames a second - 0 for every display frame. */
  @Input() maxFps = 0;
  /**
   * Starts drawing only once the page has loaded and the browser is idle,
   * fading the canvas in, so the shader stays off the page's first paint.
   */
  @Input() startWhenIdle = false;
  /**
   * Draws one still frame instead of animating on a software renderer,
   * where the CPU draws every pixel on the main thread, and where the
   * visitor asked for reduced motion.
   */
  @Input() stillOnSlowRenderer = false;

  @Output() error: EventEmitter<unknown> = new EventEmitter();
  @ViewChild('canvasContainer', { static: true })
  private canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('webGLCanvas', { static: true })
  private webGLCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stats', { static: true }) private statsElem!: ElementRef;

  fps$: Observable<number>;
  /** True until the first frame is drawn, while it fades in. */
  protected readonly waiting = signal(false);
  protected readonly bufferWidth = signal(1);
  protected readonly bufferHeight = signal(1);

  private frame: number | null = null;
  private lastFrameAt: number | null = null;
  private started = false;
  private still = false;
  private cancelStart?: () => void;

  private renderer?: WebGl2Renderer;

  private geometry?: PlaneGeometry;
  private material?: ShaderMaterial;
  private mesh?: Mesh;
  private scene?: Scene;
  private uniforms?: {
    mouse: Uniform2f;
    resolution: Uniform2f;
    time: Uniform1f;
  };

  constructor() {
    this.fps$ = this.measureFps.fps$.pipe(sampleTime(300));
  }

  private static getOffsetLeft(elem: HTMLElement | null) {
    return RenderShaderComponent.getOffset(elem, 'offsetLeft');
  }

  private static getOffsetTop(elem: HTMLElement | null) {
    return RenderShaderComponent.getOffset(elem, 'offsetTop');
  }

  private static getOffset(
    elem: HTMLElement | null,
    offset: 'offsetTop' | 'offsetLeft'
  ) {
    let e = elem;
    let result = 0;
    do {
      const offsetValue = e?.[offset];
      if (offsetValue && !isNaN(offsetValue)) {
        result += offsetValue;
      }
      e = e?.offsetParent as HTMLElement;
    } while (e);
    return result;
  }

  ngAfterViewInit() {
    const renderParams = {
      ...CONTEXT_ATTRIBUTES,
      canvas: this.webGLCanvas.nativeElement,
    };
    if (!this.isWebGL2Available()) {
      console.error('Could not create WebGL2 context');
      return;
    }
    this.renderer = new WebGl2Renderer(renderParams);
    this.uniforms = {
      time: u1f('uTime', 1.0),
      resolution: u2f('uResolution', this.canvasWidth, this.canvasHeight),
      mouse: u2f('uMouse', 0.5, 0.5),
    };

    this.onResize();

    this.scene = new Scene();

    this.geometry = new PlaneGeometry(2, 2);

    this.material = new ShaderMaterial(
      this.vertexShader || defaultVertexShader,
      this.shaderCode,
      this.uniforms
    );

    this.mesh = new Mesh(this.geometry, this.material);

    this.webGLCanvas.nativeElement.onmousemove = (e) => this.onMouseMove(e);
    this.webGLCanvas.nativeElement.ontouchmove = (e) => this.onTouchMove(e);
    this.scene.add(this.mesh);
    this.still = this.stillOnSlowRenderer && this.slowOrStill();
    if (this.startWhenIdle) {
      this.cancelStart = whenIdle(() => this.start());
    } else {
      this.start();
    }
  }

  ngOnDestroy(): void {
    this.cancelStart?.();
    this.stopLoop();
    if (this.renderer) {
      console.log('ngOnDestroy: WebGLRenderer dispose.');
      this.renderer.dispose();
    }
  }

  onMouseMove(e: MouseEvent) {
    if (this.uniforms) {
      const x = e.offsetX / this.canvasWidth;
      const y = (this.canvasHeight - e.offsetY) / this.canvasHeight;
      this.uniforms.mouse.value = [x, y];
    }
  }

  onTouchMove(e: TouchEvent) {
    if (this.uniforms) {
      const touch = e.touches[0];
      const x =
        touch.pageX -
        RenderShaderComponent.getOffsetLeft(e.target as HTMLElement);
      const y =
        touch.pageY -
        RenderShaderComponent.getOffsetTop(e.target as HTMLElement);

      const mX = Math.max(Math.min(x / this.canvasWidth, 1.0), 0.0);
      const mY = Math.max(
        Math.min((this.canvasHeight - y) / this.canvasHeight, 1.0),
        0.0
      );
      this.uniforms.mouse.value = [mX, mY];
    }
  }

  onResize() {
    if (
      this.canvasWidth &&
      this.canvasHeight &&
      this.renderer &&
      this.uniforms
    ) {
      const { width, height } = this.updateBufferSize();
      // Set at once, not only through the template: a still frame is drawn
      // before the next change detection.
      const canvas = this.webGLCanvas.nativeElement;
      canvas.width = width;
      canvas.height = height;
      this.renderer.setSize(width, height);
      this.uniforms.resolution.value = [width, height];
      // A still frame is drawn again at the new size.
      if (this.started && this.still) {
        this.render(0);
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // The template's values are known before its first check, so the
    // lifecycle hooks after it only write what is already there.
    if (changes['startWhenIdle']?.isFirstChange()) {
      this.waiting.set(this.startWhenIdle);
    }
    if (this.canvasWidth && this.canvasHeight) {
      this.updateBufferSize();
    }
    if (
      changes['runAnimation'] &&
      !changes['runAnimation'].isFirstChange() &&
      changes['runAnimation'].currentValue
    ) {
      this.loop();
    }
    if (
      changes['shaderCode'] &&
      !changes['shaderCode'].isFirstChange() &&
      this.material
    ) {
      this.material.setValues({ fragmentShader: this.shaderCode });
    }

    if (changes['canvasWidth'] && !changes['canvasWidth'].isFirstChange()) {
      this.onResize();
    }

    if (changes['canvasHeight'] && !changes['canvasHeight'].isFirstChange()) {
      this.onResize();
    }

    if (
      changes['resolutionScale'] &&
      !changes['resolutionScale'].isFirstChange()
    ) {
      this.onResize();
    }
  }

  render(time = 1) {
    if (this.uniforms && this.scene) {
      this.uniforms.time.value = time / 1000;
      this.renderer?.render(this.scene);
    }
  }

  /** Draws the first frame, then animates unless the frame stays still. */
  private start(): void {
    this.started = true;
    this.draw(performance.now());
    this.waiting.set(false);
    this.loop();
  }

  /** Runs the animation frames while `runAnimation` holds - one loop only. */
  private loop(): void {
    if (!this.started || this.still || this.frame !== null) {
      return;
    }
    this.frame = requestAnimationFrame((time) => this.animate(time));
  }

  private stopLoop(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private animate(time: number): void {
    this.frame = null;
    if (!this.runAnimation) {
      return;
    }
    if (shouldDraw(time, this.lastFrameAt, this.maxFps)) {
      this.draw(time);
    }
    this.loop();
  }

  private draw(time: number): void {
    try {
      this.render(time);
      this.lastFrameAt = time;
      this.measureFps.signalFrameReady();
    } catch (e) {
      this.error.next(e);
    }
  }

  /** The drawing buffer for the current inputs, into the template's signals. */
  private updateBufferSize(): { width: number; height: number } {
    const width = bufferSize(this.canvasWidth, this.resolutionScale);
    const height = bufferSize(this.canvasHeight, this.resolutionScale);
    this.bufferWidth.set(width);
    this.bufferHeight.set(height);
    return { width, height };
  }

  /** A software renderer, or a visitor who asked for reduced motion. */
  private slowOrStill(): boolean {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
    const gl = this.webGLCanvas.nativeElement.getContext(
      'webgl2',
      CONTEXT_ATTRIBUTES
    );
    return gl !== null && isSoftwareRenderer(rendererName(gl));
  }

  private isWebGL2Available() {
    try {
      const canvas = this.webGLCanvas.nativeElement;
      // The first getContext fixes the context's attributes for the canvas.
      return !!(
        window.WebGL2RenderingContext &&
        canvas.getContext('webgl2', CONTEXT_ATTRIBUTES)
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      return false;
    }
  }
}

/**
 * Calls `run` once the page has loaded and the browser is idle (at the
 * latest 3 s later). Returns the cancel.
 */
function whenIdle(run: () => void): () => void {
  let cancelled = false;
  let idle: number | null = null;
  const go = (): void => {
    if (cancelled) {
      return;
    }
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(() => !cancelled && run(), {
        timeout: 3000,
      });
    } else {
      idle = window.setTimeout(() => !cancelled && run(), 200);
    }
  };
  if (document.readyState === 'complete') {
    go();
  } else {
    window.addEventListener('load', go, { once: true });
  }
  return () => {
    cancelled = true;
    window.removeEventListener('load', go);
    if (idle !== null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idle);
    }
  };
}
