import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FramePacer } from '../state/frame-pacer';
import { TICK_MS, TickClock } from '../state/fixed-tick';
import { Rect } from '../state/maps';
import { Zone } from '../state/zones';
import { ArenaFrame, ArenaPainter } from './arena-painter';
import { ArenaTheme } from './arena-theme';
import { createArenaPainter } from './create-arena-painter';

/**
 * What an arena view is laid out for. Another layout gets a fresh canvas -
 * and with it a painter and a rendering context of its own.
 */
export interface ArenaLayout {
  /** The arena in cells. */
  width: number;
  height: number;
  /** Canvas pixels per arena cell, with all of the arena in view. */
  scale: number;
  /** Pixels per cell of the layers painted once, such as the zones. */
  detail: number;
  /** Arena cells per base cell - the crosshairs are as big on every grid. */
  unit: number;
}

/** What a frame shows of the war - the view adds the rest. */
export type ArenaContent = Omit<
  ArenaFrame,
  'clear' | 'deltaTimeSec' | 'timeSec' | 'view'
>;

/** What an arena view draws, and where its frames come from. */
export interface ArenaScene {
  /** What the arena shows, the crosshairs `alpha` along their last tick. */
  content(alpha: number): ArenaContent;
  /**
   * The part of the arena the frame shows - all of it without this. Asked
   * once per painted frame, so a camera may move on here.
   */
  view?(): Rect;
  /** Runs the war `ticks` on - for a view that plays by itself. */
  advance?(ticks: number): void;
  /** Called with every frame right after it was painted. */
  painted?(frame: ArenaFrame): void;
}

/** Builds the painter for a fresh canvas, null when the canvas gives none. */
export type ArenaPainterFactory = (
  canvas: HTMLCanvasElement,
  layout: ArenaLayout
) => ArenaPainter | null;

/** The painter factory - WebGL2 where the browser can, Canvas 2D otherwise. */
export const ARENA_PAINTER_FACTORY = new InjectionToken<ArenaPainterFactory>(
  'ARENA_PAINTER_FACTORY',
  {
    providedIn: 'root',
    factory: () => (canvas, layout) =>
      createArenaPainter(
        canvas,
        layout.width,
        layout.height,
        layout.scale,
        layout.detail,
        layout.unit
      ),
  }
);

/**
 * The most time one frame of a view that plays by itself takes the war
 * forward, before the speed factor: a slow device plays slower instead of
 * piling up ever more ticks.
 */
const MAX_FRAME_MS = 3 * TICK_MS;

/**
 * The arena on its canvas: owns the canvas, the painter on it and the trail
 * the frames leave, and paints whatever its {@link ArenaScene} shows.
 *
 * Frames come one of two ways. A match drives the view - it runs the war on
 * its own clock and calls {@link paintFrame} on every frame, and
 * {@link repaint} for a still one. With `autoplay` the view runs the frames
 * itself - a replay, say - advancing the scene by the ticks of each display
 * frame, `speed` times as fast, until it is `paused`.
 *
 * Painting runs outside change detection: nothing here touches a signal
 * the template reads while frames are painted.
 */
@Component({
  selector: 'feat-lazy-bac-game-arena-view',
  template: `
    @for (key of canvasKey(); track key) {
      <canvas
        #canvasElement
        class="arena-canvas"
        [attr.id]="canvasId()"
        [style.width.px]="size()?.width"
        [style.height.px]="size()?.height"
      ></canvas>
    }
  `,
  styleUrl: './arena-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArenaViewComponent implements OnDestroy {
  /** What the canvas is laid out for - see {@link ArenaLayout}. */
  public readonly layout = input.required<ArenaLayout>();
  /** What is painted. */
  public readonly scene = input.required<ArenaScene>();
  /** The level's look, and its zones painted into the floor. */
  public readonly theme = input.required<ArenaTheme>();
  public readonly zones = input.required<readonly Zone[]>();
  /** The size of the canvas in CSS pixels - the canvas's own without it. */
  public readonly size = input<{ width: number; height: number } | null>(null);
  /** The canvas element's id, none without it. */
  public readonly canvasId = input<string | null>(null);
  /** Runs the frames itself instead of waiting for {@link paintFrame}. */
  public readonly autoplay = input(false);
  /** Holds a view that plays by itself on the frame it shows. */
  public readonly paused = model(false);
  /** How many times as fast as the wall clock a view that plays by itself runs. */
  public readonly speed = model(1);

  /**
   * The painter of a fresh canvas once it is built - and null right before
   * the one before goes, while its rendering context still lasts.
   */
  public readonly painterChange = output<ArenaPainter | null>();

  private readonly factory = inject(ARENA_PAINTER_FACTORY);
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvasElement');
  /** Draws the arena - on the GPU where the browser can. */
  private readonly painter = signal<ArenaPainter | null>(null);

  /**
   * One key per layout: the canvas is rendered for the key, so another
   * layout hands the painter a fresh canvas and context.
   */
  protected readonly canvasKey = computed(() => {
    const { width, height, scale, detail, unit } = this.layout();
    return [`${width}x${height}@${scale}:${detail}:${unit}`];
  });

  /** What of the arena the last frame showed. */
  private lastView: Rect | null = null;
  /** Lay the next frame's floor down fully instead of fading into a trail. */
  private clearNextFrame = true;
  /** Seconds of animation, for the wobble of the jam and the boost shimmer. */
  private animationSec = 0;
  /** True while a still frame waits for its animation frame. */
  private repaintPending = false;
  /** The floor the painter holds, null before it got one. */
  private floor: { theme: ArenaTheme; zones: readonly Zone[] } | null = null;

  public constructor() {
    // A fresh canvas - the first one, or one for another layout - gets a
    // painter of its own.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas != null) {
        untracked(() => this.attachPainter(canvas));
      }
    });
    // Another level lays another floor.
    effect(() => {
      const theme = this.theme();
      const zones = this.zones();
      const painter = this.painter();
      if (painter != null && !this.floorIs(theme, zones)) {
        untracked(() => {
          this.layFloor(painter, theme, zones);
          this.repaint();
        });
      }
    });
    // Playing by itself: a frame loop of its own while it is not paused.
    effect((onCleanup) => {
      if (this.autoplay() && !this.paused() && this.painter() != null) {
        onCleanup(untracked(() => this.play()));
      }
    });
  }

  /** The canvas the arena is drawn on, null before it is rendered. */
  public canvas(): HTMLCanvasElement | null {
    return this.canvasRef()?.nativeElement ?? null;
  }

  /** What of the arena the last frame showed, null before the first one. */
  public shownView(): Rect | null {
    return this.lastView;
  }

  /** Holds a view that plays by itself. */
  public pause(): void {
    this.paused.set(true);
  }

  /** Lets a view that plays by itself go on. */
  public resume(): void {
    this.paused.set(false);
  }

  /** Lays the next frame's floor down fully - for a fresh match. */
  public clearNext(): void {
    this.clearNextFrame = true;
  }

  /**
   * Puts the last painted frame on the canvas again, for a snapshot taken
   * right after - see {@link ArenaPainter.showLastFrame}.
   */
  public showLastFrame(): void {
    this.painter()?.showLastFrame();
  }

  /**
   * Paints a frame the scene moved on to - called by whoever runs the war,
   * inside the animation frame, so what is painted is shown on that frame.
   * `alpha` is how far the crosshairs are drawn along their last tick.
   */
  public paintFrame(elapsedSec: number, alpha: number): void {
    this.paint(elapsedSec, false, alpha);
  }

  /**
   * Paints the arena as it stands, on the next animation frame - whenever
   * it changes while nothing runs the war. The frame is cleared: the fade
   * alone would leave the walls of the last map as ghosts on the canvas.
   */
  public repaint(): void {
    if (untracked(this.painter) == null || this.repaintPending) {
      return;
    }
    this.repaintPending = true;
    requestAnimationFrame(() => {
      this.repaintPending = false;
      this.paint(1 / 1000, true, 1);
    });
  }

  public ngOnDestroy(): void {
    // The GPU simulation lives in this canvas's context, which goes with
    // it: tell first, while the context still lasts.
    const painter = this.painter();
    if (painter != null) {
      this.painterChange.emit(null);
      painter.dispose();
    }
  }

  /**
   * Builds the painter for a fresh canvas and lets go of the one before -
   * telling first, while the old context still lasts.
   */
  private attachPainter(canvas: HTMLCanvasElement): void {
    const old = this.painter();
    if (old != null) {
      this.painterChange.emit(null);
      old.dispose();
      this.painter.set(null);
    }
    const painter = this.factory(canvas, this.layout());
    this.lastView = null;
    if (painter == null) {
      throw new Error('Could not get rendering context');
    }
    // Which painter runs - for the e2e tests and for anyone debugging.
    canvas.dataset['renderer'] = painter.kind;
    // The floor goes in before anyone else uses the context.
    this.floor = null;
    this.layFloor(painter, this.theme(), this.zones());
    this.painter.set(painter);
    this.painterChange.emit(painter);
    this.repaint();
  }

  /** True when the painter's floor is already this one. */
  private floorIs(theme: ArenaTheme, zones: readonly Zone[]): boolean {
    return this.floor?.theme === theme && this.floor.zones === zones;
  }

  private layFloor(
    painter: ArenaPainter,
    theme: ArenaTheme,
    zones: readonly Zone[]
  ): void {
    painter.setFloor(theme, zones);
    this.floor = { theme, zones };
  }

  /** Paints one frame, moving the view on first. */
  private paint(deltaTimeSec: number, clear: boolean, alpha: number): void {
    const painter = untracked(this.painter);
    if (painter == null) {
      return;
    }
    const scene = untracked(this.scene);
    this.animationSec += deltaTimeSec;
    const { width, height } = untracked(this.layout);
    const view = scene.view?.() ?? { x: 0, y: 0, width, height };
    // The trail of the last frame lies elsewhere in a view that moved - by
    // half a pixel or more: the spring creeps on by less for a long while.
    const last = this.lastView;
    const halfPixel = view.width / (2 * (this.canvas()?.width || 1));
    const moved =
      last == null ||
      Math.abs(last.x - view.x) >= halfPixel ||
      Math.abs(last.y - view.y) >= halfPixel ||
      Math.abs(last.width - view.width) >= halfPixel;
    this.lastView = view;
    const frame: ArenaFrame = {
      ...scene.content(alpha),
      clear: clear || this.clearNextFrame || moved,
      deltaTimeSec,
      timeSec: this.animationSec,
      view,
    };
    this.clearNextFrame = false;
    painter.paint(frame);
    scene.painted?.(frame);
  }

  /**
   * Runs the frames of a view that plays by itself: on the display frames
   * the pacer picks, by whole ticks of the scaled clock. Returns the stop.
   */
  private play(): () => void {
    const pacer = new FramePacer();
    const clock = new TickClock();
    const onFrame = (timestamp: number): void => {
      handle = requestAnimationFrame(onFrame);
      const elapsed = pacer.frame(timestamp);
      if (elapsed == null) {
        return;
      }
      const frame = clock.advance(
        Math.min(elapsed, MAX_FRAME_MS) * untracked(this.speed)
      );
      if (frame.ticks > 0) {
        untracked(this.scene).advance?.(frame.ticks);
      }
      this.paint(frame.elapsedSec, false, frame.alpha);
    };
    let handle = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(handle);
  }
}
