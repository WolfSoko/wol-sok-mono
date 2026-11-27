import type { LoadingWaveOptions } from './loading-wave-options';
import type { WaveLook, WaveRenderer, WaveRendererKind } from './renderer';
import type { Disconnect, WaveEnvironment } from './wave-environment';
import { waveGeometry } from './wave-model';
import { WaveTimeline } from './wave-timeline';
import { rippleShader } from './webgl/shaders/ripple.shader';

/** styles that lay the canvas behind the host's content, filling it */
const CANVAS_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  inset: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
  zIndex: '-1',
};

/**
 * The most device pixels a wave's canvas holds: a tall host (a whole page)
 * gets a lower pixel ratio rather than a canvas of hundreds of megabytes.
 */
export const MAX_CANVAS_PIXELS = 4_000_000;

/** the device pixel ratio, lowered where the canvas would grow too large */
export function fitPixelRatio(
  width: number,
  height: number,
  pixelRatio: number
): number {
  const area = width * height;
  return area <= 0
    ? pixelRatio
    : Math.min(pixelRatio, Math.sqrt(MAX_CANVAS_PIXELS / area));
}

/**
 * The loading wave of one host element, without Angular: puts a canvas
 * behind the host's content while loading, runs the animation and removes
 * it again (`'hide'`) or leaves the resting dots (`'keep'`).
 */
export class LoadingWave {
  private renderer?: WaveRenderer;
  private timeline?: WaveTimeline;
  private frameId?: number;
  private visible = true;
  private loading = false;
  private disconnects: Disconnect[] = [];
  private hostStyle?: { position: string; isolation: string };

  public constructor(
    private readonly host: HTMLElement,
    private options: LoadingWaveOptions,
    private readonly env: WaveEnvironment,
    private readonly onRendererChange: (
      kind: WaveRendererKind | null
    ) => void = () => undefined
  ) {}

  public setLoading(loading: boolean): void {
    if (loading === this.loading) {
      return;
    }
    this.loading = loading;
    if (loading) {
      this.host.setAttribute('aria-busy', 'true');
      if (this.timeline == null) {
        this.mount(0);
      }
      this.timeline?.start(this.env.now());
    } else {
      this.host.removeAttribute('aria-busy');
      this.timeline?.stop(this.env.now());
      // off screen no frame would finish the fade: free the canvas right away
      if (!this.visible && this.options.afterLoading === 'hide') {
        this.unmount();
      }
    }
    this.scheduleFrame();
  }

  /**
   * applies new options: look, spacing and speed in place; a new renderer or
   * `afterLoading` starts a running effect over, and resting dots stay where
   * the new options keep them
   */
  public setOptions(options: LoadingWaveOptions): void {
    const previous = this.options;
    this.options = options;
    if (this.timeline == null) {
      return;
    }
    if (
      options.renderer === previous.renderer &&
      options.afterLoading === previous.afterLoading &&
      fragmentOf(options) === fragmentOf(previous)
    ) {
      this.renderer?.setLook(this.look());
      this.renderer?.setShaderUniforms(options.shader?.uniforms);
      this.resize();
      return;
    }
    this.unmount();
    if (this.loading) {
      this.mount(0);
      this.timeline?.start(this.env.now());
    } else if (options.afterLoading === 'keep') {
      this.mount(1);
    }
    this.scheduleFrame();
  }

  public dispose(): void {
    this.unmount();
    this.host.removeAttribute('aria-busy');
  }

  private mount(restingDots: number): void {
    const renderer = this.createRenderer(this.options.renderer);
    if (renderer == null) {
      return;
    }
    this.styleHost();
    // last, not first: hydration finds the host's own nodes from its first child
    this.host.append(renderer.canvas);
    this.renderer = renderer;
    this.timeline = new WaveTimeline(
      this.options.afterLoading,
      !this.env.prefersReducedMotion(),
      restingDots
    );
    this.visible = true;
    this.disconnects = [
      this.env.observeSize(this.host, () => this.resize()),
      this.env.observeVisibility(this.host, (visible) =>
        this.setVisible(visible)
      ),
      this.env.observeTheme(() => this.recolor()),
    ];
    this.resize();
    this.onRendererChange(renderer.kind);
  }

  private unmount(): void {
    this.cancelFrame();
    this.disconnects.forEach((disconnect) => disconnect());
    this.disconnects = [];
    if (this.renderer != null) {
      this.renderer.dispose();
      this.renderer.canvas.remove();
      this.onRendererChange(null);
    }
    this.renderer = undefined;
    this.timeline = undefined;
    this.restoreHost();
  }

  private createRenderer(
    preference: LoadingWaveOptions['renderer']
  ): WaveRenderer | null {
    const renderer = this.env.chooseRenderer({
      preference,
      look: this.look(),
      shader: this.options.shader ?? rippleShader,
      createCanvas: () => this.env.createCanvas(),
      onContextLost: () => this.fallBackToCanvas(),
    });
    if (renderer != null) {
      renderer.canvas.setAttribute('aria-hidden', 'true');
      Object.assign(renderer.canvas.style, CANVAS_STYLE);
    }
    return renderer;
  }

  /** the GPU took the WebGL context away: go on with a 2D canvas */
  private fallBackToCanvas(): void {
    const lost = this.renderer;
    const replacement = this.createRenderer('canvas');
    if (lost == null || replacement == null) {
      this.unmount();
      return;
    }
    lost.canvas.replaceWith(replacement.canvas);
    lost.dispose();
    this.renderer = replacement;
    this.resize();
    this.onRendererChange(replacement.kind);
  }

  private look(): WaveLook {
    const { dotSize, color, accentColor } = this.options;
    return {
      dotSize,
      color: this.env.resolveColor(this.host, color),
      accent:
        accentColor === undefined
          ? undefined
          : this.env.resolveColor(this.host, accentColor),
    };
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.host;
    this.renderer?.resize(
      waveGeometry(width, height, {
        dotSpacing: this.options.dotSpacing,
        sweepMs: this.options.sweepMs,
        frontRoundness: this.options.frontRoundness,
      }),
      fitPixelRatio(width, height, this.env.pixelRatio())
    );
    // a resized canvas is blank until drawn again
    this.scheduleFrame();
  }

  private recolor(): void {
    this.renderer?.setLook(this.look());
    this.scheduleFrame();
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      this.scheduleFrame();
    } else {
      this.cancelFrame();
    }
  }

  private scheduleFrame(): void {
    if (this.frameId != null || !this.visible || this.renderer == null) {
      return;
    }
    this.frameId = this.env.requestFrame(() => this.drawFrame());
  }

  private cancelFrame(): void {
    if (this.frameId != null) {
      this.env.cancelFrame(this.frameId);
      this.frameId = undefined;
    }
  }

  private drawFrame(): void {
    this.frameId = undefined;
    if (this.renderer == null || this.timeline == null) {
      return;
    }
    const { frame, settled, finished } = this.timeline.frameAt(this.env.now());
    if (finished) {
      this.unmount();
      return;
    }
    this.renderer.draw(frame);
    if (!settled) {
      this.scheduleFrame();
    }
  }

  /**
   * `isolation` keeps the canvas's `z-index: -1` above the host's own
   * background; a static host becomes `relative` to hold the canvas.
   */
  private styleHost(): void {
    const { style } = this.host;
    this.hostStyle = { position: style.position, isolation: style.isolation };
    const view = this.host.ownerDocument.defaultView;
    const position = view?.getComputedStyle(this.host).position;
    // jsdom leaves an unset position empty
    if (position === 'static' || position === '') {
      style.position = 'relative';
    }
    style.isolation = 'isolate';
  }

  private restoreHost(): void {
    if (this.hostStyle != null) {
      this.host.style.position = this.hostStyle.position;
      this.host.style.isolation = this.hostStyle.isolation;
      this.hostStyle = undefined;
    }
  }
}

/** a changed fragment needs a new program, changed uniforms do not */
function fragmentOf(options: LoadingWaveOptions): string {
  return (options.shader ?? rippleShader).fragment;
}
