import {
  dotsOpacity,
  type Rgb,
  FRONT_LINE_ALPHA,
  LIT_ALPHA,
  LIT_GROWTH,
  REST_ALPHA,
  sizeCanvas,
  WaveFrame,
  WaveLook,
  WaveRenderer,
} from './renderer';
import {
  dotCenters,
  dotDisplacement,
  frontRadius,
  Point,
  WaveGeometry,
  waveIntensity,
} from './wave-model';

/** a dot the wave lights, drawn on its own */
interface LitDot {
  readonly center: Point;
  readonly intensity: number;
}

/** below this a dot counts as at rest and is drawn in one batch */
const LIT_THRESHOLD = 0.01;

/**
 * Draws the wave of the video with the 2D canvas API: dots that brighten,
 * grow and are pushed a little behind the front, and the front's hairline.
 * Runs everywhere, with or without a GPU.
 */
export class CanvasWaveRenderer implements WaveRenderer {
  public readonly kind = 'canvas';
  private geometry?: WaveGeometry;
  private centers: Point[] = [];
  private pixelRatio = 1;

  private constructor(
    public readonly canvas: HTMLCanvasElement,
    private readonly context: CanvasRenderingContext2D,
    private look: WaveLook
  ) {}

  /** `null` where the canvas has no 2D context */
  public static create(
    canvas: HTMLCanvasElement,
    look: WaveLook
  ): CanvasWaveRenderer | null {
    const context = canvas.getContext('2d');
    return context == null
      ? null
      : new CanvasWaveRenderer(canvas, context, look);
  }

  public resize(geometry: WaveGeometry, pixelRatio: number): void {
    this.geometry = geometry;
    this.pixelRatio = pixelRatio;
    this.centers = dotCenters(geometry);
    sizeCanvas(this.canvas, geometry, pixelRatio);
  }

  public draw(frame: WaveFrame): void {
    const { context, canvas, geometry } = this;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    // the colours' own opacities are applied per dot, as the shader does
    const { color, accent = color } = this.look;
    const visible = Math.max(
      dotsOpacity(frame, color),
      dotsOpacity(frame, accent)
    );
    if (geometry == null || visible <= 0) {
      return;
    }
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    const litDots = this.drawRestingDots(geometry, frame);
    this.drawLitDots(geometry, frame, litDots);
    this.drawFrontLine(geometry, frame);
    context.globalAlpha = 1;
  }

  public setLook(look: WaveLook): void {
    this.look = look;
  }

  /** a 2D canvas runs no shader */
  public setShaderUniforms(): void {
    // nothing to set
  }

  public dispose(): void {
    this.geometry = undefined;
    this.centers = [];
  }

  /** draws every dot at rest in one path, returns the lit ones */
  private drawRestingDots(geometry: WaveGeometry, frame: WaveFrame): LitDot[] {
    const { context } = this;
    const radius = this.look.dotSize / 2;
    const lit: LitDot[] = [];
    context.globalAlpha = dotsOpacity(frame, this.look.color) * REST_ALPHA;
    context.beginPath();
    for (const center of this.centers) {
      const intensity =
        frame.wave > 0
          ? frame.wave *
            waveIntensity(center.x, center.y, frame.elapsedMs, geometry)
          : 0;
      if (intensity >= LIT_THRESHOLD) {
        lit.push({ center, intensity });
        continue;
      }
      context.moveTo(center.x + radius, center.y);
      context.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    }
    context.fill();
    return lit;
  }

  private drawLitDots(
    geometry: WaveGeometry,
    frame: WaveFrame,
    litDots: LitDot[]
  ): void {
    const { context } = this;
    const restRadius = this.look.dotSize / 2;
    const { color, accent = color } = this.look;
    for (const { center, intensity } of litDots) {
      if (accent !== color) {
        context.fillStyle = mixedRgb(color, accent, intensity);
      }
      const { dx, dy } = dotDisplacement(
        center.x,
        center.y,
        frame.elapsedMs,
        geometry
      );
      context.globalAlpha =
        frame.dots *
        mixedAlpha(color, accent, intensity) *
        (REST_ALPHA + (LIT_ALPHA - REST_ALPHA) * intensity);
      context.beginPath();
      context.arc(
        center.x + dx * frame.wave,
        center.y + dy * frame.wave,
        restRadius * (1 + LIT_GROWTH * intensity),
        0,
        2 * Math.PI
      );
      context.fill();
    }
  }

  private drawFrontLine(geometry: WaveGeometry, frame: WaveFrame): void {
    if (frame.wave <= 0) {
      return;
    }
    const { context } = this;
    const { color, accent = color } = this.look;
    context.strokeStyle = mixedRgb(color, accent, 1);
    context.globalAlpha =
      frame.dots * (accent.alpha ?? 1) * frame.wave * FRONT_LINE_ALPHA;
    context.lineWidth = 1 / this.pixelRatio;
    context.beginPath();
    context.arc(
      geometry.centerX,
      geometry.centerY,
      frontRadius(geometry, frame.elapsedMs),
      -Math.PI / 2,
      Math.PI / 2
    );
    context.stroke();
  }
}

/** the colours' own opacity `share` of the way from `from` to `to` */
function mixedAlpha(from: Rgb, to: Rgb, share: number): number {
  const fromAlpha = from.alpha ?? 1;
  return fromAlpha + ((to.alpha ?? 1) - fromAlpha) * share;
}

/** the CSS colour `share` of the way from `from` to `to` */
function mixedRgb(from: Rgb, to: Rgb, share: number): string {
  const mix = (a: number, b: number) => Math.round(a + (b - a) * share);
  return `rgb(${mix(from.r, to.r)}, ${mix(from.g, to.g)}, ${mix(from.b, to.b)})`;
}
