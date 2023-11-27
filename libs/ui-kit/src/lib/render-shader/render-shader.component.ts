import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
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

@Component({
  standalone: true,
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
  @Input() shaderCode!: FragCode;
  @Input() vertexShader!: VertCode;
  @Input() runAnimation: boolean | null = true;
  @Input() showFps = false;
  @Input() canvasWidth!: number;
  @Input() canvasHeight!: number;
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() error: EventEmitter<unknown> = new EventEmitter();
  @ViewChild('canvasContainer', { static: true })
  private canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('webGLCanvas', { static: true })
  private webGLCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stats', { static: true }) private statsElem!: ElementRef;

  fps$: Observable<number>;

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

  constructor(
    private ngZone: NgZone,
    private readonly measureFps: MeasureFps
  ) {
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
      antialias: true,
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
    this.animate(1.0);
  }

  ngOnDestroy(): void {
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
      this.renderer.setSize(this.canvasWidth, this.canvasHeight);
      this.uniforms.resolution.value = [this.canvasWidth, this.canvasHeight];
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['runAnimation'] &&
      !changes['runAnimation'].isFirstChange() &&
      changes['runAnimation'].currentValue
    ) {
      this.animate(1.0);
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
  }

  render(time = 1) {
    if (this.uniforms && this.scene) {
      this.uniforms.time.value = time / 1000;
      this.renderer?.render(this.scene);
    }
  }

  animate(time = 1.0) {
    try {
      this.ngZone.runOutsideAngular(() => {
        this.render(time);
        this.measureFps.signalFrameReady();
        if (this.runAnimation) {
          requestAnimationFrame((timestamp) => this.animate(timestamp));
        }
      });
    } catch (e) {
      this.error.next(e);
    }
  }

  private isWebGL2Available() {
    try {
      const canvas = this.webGLCanvas.nativeElement;
      return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  }
}
