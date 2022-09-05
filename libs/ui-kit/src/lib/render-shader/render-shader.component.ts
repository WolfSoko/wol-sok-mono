import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { MeasureFps } from '@wolsok/utils-measure-fps';
import { sampleTime } from 'rxjs';
import {
  Camera,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Renderer,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';
import { ShowFpsComponent } from '../show-fps/show-fps.component';
import { defaultVertexShader } from './default-vertex-shader';

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
  @Input() shaderCode!: string;
  @Input() vertexShader!: string;
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

  fps$ = this.measureFps.fps$.pipe(sampleTime(300));

  private renderer?: Renderer;

  private camera?: Camera;
  private geometry?: PlaneGeometry;
  private material?: ShaderMaterial;
  private mesh?: Mesh;

  private scene?: Scene;
  private uniforms?: {
    mouse: { value: Vector2 };
    resolution: { value: Vector2 };
    time: { value: number };
  };

  constructor(
    @Inject(NgZone) private _ngZone: NgZone,
    private readonly measureFps: MeasureFps
  ) {}

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
    this.renderer = new WebGLRenderer(renderParams);

    this.uniforms = {
      time: { value: 1.0 },
      resolution: { value: new Vector2(this.canvasWidth, this.canvasHeight) },
      mouse: { value: new Vector2(0.5, 0.5) },
    };

    this.onResize();

    this.scene = new Scene();

    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.geometry = new PlaneGeometry(2, 2);

    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vertexShader || defaultVertexShader,
      fragmentShader: this.shaderCode,
    });

    this.mesh = new Mesh(this.geometry, this.material);

    this.webGLCanvas.nativeElement.onmousemove = (e) => this.onMouseMove(e);
    this.webGLCanvas.nativeElement.ontouchmove = (e) => this.onTouchMove(e);
    this.scene.add(this.mesh);
    this.animate(1.0);
  }

  ngOnDestroy(): void {
    if (this.renderer instanceof WebGLRenderer) {
      console.log('ngOnDestroy: WebGLRenderer dispose.');
      this.renderer.forceContextLoss();
      this.renderer.dispose();
    }
  }

  onMouseMove(e: MouseEvent) {
    if (this.uniforms) {
      this.uniforms.mouse.value.x = e.offsetX / this.canvasWidth;
      this.uniforms.mouse.value.y =
        (this.canvasHeight - e.offsetY) / this.canvasHeight;
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

      this.uniforms.mouse.value.x = Math.max(
        Math.min(x / this.canvasWidth, 1.0),
        0.0
      );
      this.uniforms.mouse.value.y = Math.max(
        Math.min((this.canvasHeight - y) / this.canvasHeight, 1.0),
        0.0
      );
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
      this.uniforms.resolution.value = new Vector2(
        this.canvasWidth,
        this.canvasHeight
      );
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
      this.material.needsUpdate = true;
    }

    if (changes['canvasWidth'] && !changes['canvasWidth'].isFirstChange()) {
      this.onResize();
    }

    if (changes['canvasHeight'] && !changes['canvasHeight'].isFirstChange()) {
      this.onResize();
    }
  }

  render(time: number = 1) {
    if (this.uniforms && this.scene && this.camera) {
      this.uniforms.time.value = time / 1000;
      this.renderer?.render(this.scene, this.camera);
    }
  }

  animate(time: number = 1.0) {
    try {
      this._ngZone.runOutsideAngular(() => {
        if (this.runAnimation) {
          requestAnimationFrame((timestamp) => this.animate(timestamp));
        }
        this.render(time);
        this.measureFps.signalFrameReady();
      });
    } catch (e) {
      this.error.next(e);
    }
  }
}
