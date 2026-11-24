import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  prefersReducedMotion,
  type Rgb,
  rgba,
} from '@wolsok/feat-bacteria-rendering';
import { TranslatePipe } from '../i18n/translate.pipe';
import {
  BACTERIUM_ANCHORS,
  CELL_BLEED,
  type BacteriumItem,
  type BacteriumItemId,
} from './bacterium/bacterium-items';
import {
  bacteriumLook,
  cssRgb,
  DEFAULT_PLAYER_RGB,
} from './bacterium/bacterium-look';
import {
  BACTERIUM_RENDERER,
  type BacteriumRenderer,
  type BacteriumScene,
} from './bacterium/bacterium-renderer';
import { MAX_LOBES } from './bacterium/bacterium-shader';

/** The cell redraws at most this often. */
const FRAME_MS = 1000 / 30;

/**
 * The main menu's actions as the parts of a living, turning bacterium
 * (#3194, the main menu since #3210): a new game in the nucleus,
 * online and the other screens on lobes round the membrane. The cell grows
 * more impressive with the player's XP (`bacteriumLook`), and a part whose
 * DNA buys something glows gold, button and lobe (`BacteriumItem.ready`).
 *
 * The parts are real buttons (links for a page) laid over the cell at the
 * anchors the shader draws their lobes at, so keys, screen readers and
 * focus work as on the tiles; the canvas is decoration. Where WebGL cannot
 * draw it (`BACTERIUM_RENDERER` answers null, or the context is lost
 * later) a CSS cell with the same parts stands in. It animates only while
 * the page is visible; with reduced motion the cell holds still and redraws
 * only when a part lights up.
 */
@Component({
  selector: 'feat-lazy-bac-game-bacterium-menu',
  imports: [MatIconModule, NgTemplateOutlet, TranslatePipe],
  templateUrl: './bacterium-menu.component.html',
  styleUrl: './bacterium-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.css-cell]': 'fallback()',
    '[style.--cell-body]': 'colours().body',
    '[style.--cell-rim]': 'colours().rim',
    '[style.--cell-glow]': 'look().glow',
    '[style.--cell-bleed]': 'bleed',
  },
})
export class BacteriumMenuComponent {
  /** The parts to offer, in reading order (`bacteriumItems`). */
  public readonly items = input.required<readonly BacteriumItem[]>();
  /** The player's XP, which the cell's look grows with. */
  public readonly xp = input(0);
  /** The player's colony colour, 0 to 255 a channel: the rim light's. */
  public readonly player = input<Rgb>(DEFAULT_PLAYER_RGB);

  /** A part picked that is no link. */
  public readonly pick = output<BacteriumItemId>();

  protected readonly look = computed(() =>
    bacteriumLook(this.xp(), this.player())
  );
  protected readonly colours = computed(() => ({
    body: cssRgb(this.look().body),
    rim: rgba(this.player()),
  }));
  /** True where the cell is drawn with CSS rather than WebGL. */
  protected readonly fallback = signal(false);
  /** The part under the pointer or the focus. */
  protected readonly hot = signal<BacteriumItemId | null>(null);

  /** The lobes round the rim: every part but the nucleus. */
  protected readonly lobes = computed(() =>
    this.items().filter((item) => item.id !== 'play')
  );

  protected readonly anchors = BACTERIUM_ANCHORS;
  protected readonly bleed = CELL_BLEED;

  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly createRenderer = inject(BACTERIUM_RENDERER);
  private readonly reducedMotion = prefersReducedMotion();
  private renderer: BacteriumRenderer | null = null;
  /** The pending animation frame, 0 while none is. */
  private frame = 0;
  /** When the last animated frame was drawn. */
  private last = 0;

  public constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      this.renderer = this.createRenderer(canvas);
      if (this.renderer === null) {
        this.fallback.set(true);
        return;
      }
      const page = canvas.ownerDocument;
      const onVisibility = () => this.runWhenSeen();
      // A context the browser takes back (a GPU reset, a tab in the
      // background on a phone) leaves the CSS cell in its place.
      const onLost = () => {
        this.stop();
        this.renderer = null;
        this.fallback.set(true);
      };
      const observer =
        typeof ResizeObserver === 'function'
          ? new ResizeObserver(() => this.resize())
          : null;
      page.addEventListener('visibilitychange', onVisibility);
      canvas.addEventListener('webglcontextlost', onLost);
      observer?.observe(canvas);
      destroyRef.onDestroy(() => {
        page.removeEventListener('visibilitychange', onVisibility);
        canvas.removeEventListener('webglcontextlost', onLost);
        observer?.disconnect();
        this.stop();
        this.renderer?.dispose();
        this.renderer = null;
      });
      this.resize();
      this.runWhenSeen();
    });
    // A still cell draws again when what it shows changes; a change of
    // reduced motion starts or stops the animation.
    effect(() => {
      const scene = this.scene();
      const still = this.reducedMotion();
      untracked(() => {
        if (still) {
          this.renderer?.draw(scene, 0);
        }
        this.runWhenSeen();
      });
    });
  }

  protected left(id: BacteriumItemId): number {
    return ((this.anchors[id].x + 1) / 2) * 100;
  }

  protected top(id: BacteriumItemId): number {
    return ((1 - this.anchors[id].y) / 2) * 100;
  }

  /** The scene a frame draws. */
  private readonly scene = computed((): BacteriumScene => {
    const lobes = this.lobes();
    const hot = this.hot();
    return {
      look: this.look(),
      lobes: lobes.map((item) => ({
        ...this.anchors[item.id],
        ready: item.ready,
      })),
      hot:
        hot === 'play' ? MAX_LOBES : lobes.findIndex((item) => item.id === hot),
    };
  });

  /** Sizes the drawing buffer to the canvas and draws a frame. */
  private resize(): void {
    const renderer = this.renderer;
    if (renderer === null) {
      return;
    }
    const canvas = this.canvas().nativeElement;
    renderer.resize(
      canvas.clientWidth,
      canvas.clientHeight,
      globalThis.devicePixelRatio ?? 1
    );
    renderer.draw(this.scene(), this.reducedMotion() ? 0 : performance.now());
  }

  /** Animates while the cell can be seen and may move, else stops. */
  private runWhenSeen(): void {
    const runs =
      this.renderer !== null &&
      !this.canvas().nativeElement.ownerDocument.hidden &&
      !this.reducedMotion();
    if (!runs) {
      this.stop();
    } else if (this.frame === 0) {
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (now: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    if (now - this.last >= FRAME_MS) {
      this.last = now;
      this.renderer?.draw(this.scene(), now);
    }
  };

  private stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
