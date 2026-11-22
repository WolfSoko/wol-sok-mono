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
import { MatIconModule } from '@angular/material/icon';
import { prefersReducedMotion } from '@wolsok/feat-bacteria-rendering';
import { TranslatePipe } from '../i18n/translate.pipe';
import {
  BACTERIUM_ANCHORS,
  type BacteriumItem,
  type BacteriumItemId,
} from './bacterium/bacterium-items';
import { bacteriumLook, cssRgb } from './bacterium/bacterium-look';
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
 * (#3194, behind the `bacteriumMenu` toggle): a new game in the nucleus,
 * online and the other screens on lobes round the membrane. The cell grows
 * more impressive with the player's XP (`bacteriumLook`).
 *
 * The parts are real buttons (links for a page) laid over the cell at the
 * anchors the shader draws their lobes at, so keys, screen readers and
 * focus work as on the tiles; the canvas is decoration. Where WebGL cannot
 * draw it (`BACTERIUM_RENDERER` answers null) a CSS cell with the same
 * parts stands in. With reduced motion the cell holds still and redraws
 * only when a part lights up.
 */
@Component({
  selector: 'feat-lazy-bac-game-bacterium-menu',
  imports: [MatIconModule, TranslatePipe],
  templateUrl: './bacterium-menu.component.html',
  styleUrl: './bacterium-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.css-cell]': 'fallback()',
    '[style.--cell-body]': 'colours().body',
    '[style.--cell-rim]': 'colours().rim',
    '[style.--cell-glow]': 'look().glow',
  },
})
export class BacteriumMenuComponent {
  /** The parts to offer, in reading order (`bacteriumItems`). */
  public readonly items = input.required<readonly BacteriumItem[]>();
  /** The player's XP, which the cell's look grows with. */
  public readonly xp = input(0);

  /** A part picked that is no link. */
  public readonly pick = output<BacteriumItemId>();

  protected readonly look = computed(() => bacteriumLook(this.xp()));
  protected readonly colours = computed(() => ({
    body: cssRgb(this.look().body),
    rim: cssRgb(this.look().rim),
  }));
  /** True where the cell is drawn with CSS rather than WebGL. */
  protected readonly fallback = signal(false);
  /** The part under the pointer or the focus. */
  protected readonly hot = signal<BacteriumItemId | null>(null);

  /** The lobes round the rim: every part but the nucleus. */
  private readonly lobes = computed(() =>
    this.items().filter((item) => item.id !== 'play')
  );

  protected readonly anchors = BACTERIUM_ANCHORS;

  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly createRenderer = inject(BACTERIUM_RENDERER);
  private readonly reducedMotion = prefersReducedMotion();
  private renderer: BacteriumRenderer | null = null;

  public constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.renderer = this.createRenderer(this.canvas().nativeElement);
      if (this.renderer === null) {
        this.fallback.set(true);
        return;
      }
      const stop = this.run(this.renderer);
      destroyRef.onDestroy(() => {
        stop();
        this.renderer?.dispose();
        this.renderer = null;
      });
    });
    // A still cell draws again when what it shows changes.
    effect(() => {
      const scene = this.scene();
      if (this.reducedMotion()) {
        untracked(() => this.renderer?.draw(scene, 0));
      }
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
      lobes: lobes.map((item) => this.anchors[item.id]),
      hot:
        hot === 'play' ? MAX_LOBES : lobes.findIndex((item) => item.id === hot),
    };
  });

  /** Sizes and draws the cell until the returned stop is called. */
  private run(renderer: BacteriumRenderer): () => void {
    const canvas = this.canvas().nativeElement;
    const resize = () => {
      renderer.resize(
        canvas.clientWidth,
        canvas.clientHeight,
        globalThis.devicePixelRatio ?? 1
      );
      renderer.draw(this.scene(), performance.now());
    };
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    resize();
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!this.reducedMotion() && now - last >= FRAME_MS) {
        last = now;
        renderer.draw(this.scene(), now);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }
}
