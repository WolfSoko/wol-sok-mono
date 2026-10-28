import { wrap } from '../state/geometry';
import { Rect } from '../state/maps';
import { ArenaTheme, Rgb } from './arena-theme';
import { createCanvas, rgba } from './canvas-math';

/** A bubble rising through the dish. */
interface Bubble {
  x: number;
  y: number;
  /** In arena cells. */
  radius: number;
  /** Cells per second upwards. */
  speed: number;
  /** How far it sways from side to side, in cells, and where in the sway it is. */
  sway: number;
  phase: number;
}

/** A wisp of mist drifting over the floor. */
interface Wisp {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
}

/** The numbers the ambience is tuned by. Lengths are in arena cells. */
export const AMBIENCE = {
  /** Bubbles per cell of the arena - a few dozen on the base arena. */
  bubblesPerCell: 1 / 1400,
  bubbleRadiusMin: 0.5,
  bubbleRadiusVary: 1.3,
  bubbleSpeedMin: 2.5,
  bubbleSpeedVary: 4,
  sway: 0.6,
  swayRate: 1.5,
  wisps: 6,
  wispRadiusMin: 18,
  wispRadiusVary: 22,
  wispAlpha: 0.045,
  wispDrift: 1.2,
  /** The shadow of the dish's rim: how dark, and how far in, as a share of the shorter side. */
  rimShade: 0.35,
  rimWidth: 0.08,
  /** The sheen of the glass over the dish, from the top left. */
  sheen: 0.07,
} as const;

/** The size of the sprite a wisp is drawn with. */
const WISP_SPRITE = 128;

/** The gradients the depth of the dish is painted with, for one scale and canvas. */
interface DepthBrushes {
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  /** How far the rim's shadow reaches in, in canvas pixels. */
  reach: number;
  /** The shadow fading in each direction, from the origin. */
  rightwards: CanvasGradient;
  leftwards: CanvasGradient;
  downwards: CanvasGradient;
  upwards: CanvasGradient;
  sheen: CanvasGradient;
}

/**
 * What makes the dish feel like a dish of liquid under glass, drawn over
 * the arena after the colonies, by both painters alike: bubbles rising
 * and swaying, popping at the top and rising again from the bottom, wisps
 * of mist drifting with the level's current, and the depth of the dish -
 * the shadow its rim throws inside and a sheen on the glass.
 *
 * Everything is in arena cells, so a camera over a big map carries it
 * along. Nothing of it touches the match: the bubbles live here, from this
 * `random`, never in the engine.
 */
export class DishAmbience {
  private bubbles: Bubble[] = [];
  private wisps: Wisp[] = [];
  /** Room for the bubbles in view, three numbers each, kept between frames. */
  private seen = new Float64Array(0);
  private theme: ArenaTheme | null = null;
  private sprite: HTMLCanvasElement | null = null;
  /** The brushes of the dish's depth, for the scale and the canvas last drawn on. */
  private depth: DepthBrushes | null = null;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly random: () => number = Math.random
  ) {
    this.reset();
  }

  /** Follows another level's look: its current and the colour of its mist. */
  public setTheme(theme: ArenaTheme): void {
    if (theme === this.theme) {
      return;
    }
    this.theme = theme;
    this.sprite = this.paintSprite(theme.motes);
  }

  /** Scatters a fresh set of bubbles and wisps. */
  public reset(): void {
    const count = Math.round(
      this.width * this.height * AMBIENCE.bubblesPerCell
    );
    this.bubbles = Array.from({ length: count }, () =>
      this.spawnBubble(this.random() * this.height)
    );
    this.seen = new Float64Array(count * 3);
    this.wisps = Array.from({ length: AMBIENCE.wisps }, () => ({
      x: this.random() * this.width,
      y: this.random() * this.height,
      radius: AMBIENCE.wispRadiusMin + this.random() * AMBIENCE.wispRadiusVary,
      vx: (this.random() - 0.5) * AMBIENCE.wispDrift,
      vy: (this.random() - 0.5) * AMBIENCE.wispDrift,
      alpha: AMBIENCE.wispAlpha * (0.6 + 0.8 * this.random()),
    }));
  }

  /** Lets the bubbles rise and the wisps drift on by one frame. */
  public advance(deltaTimeSec: number): void {
    for (const bubble of this.bubbles) {
      bubble.y -= bubble.speed * deltaTimeSec;
      bubble.phase += AMBIENCE.swayRate * deltaTimeSec;
      if (bubble.y < -bubble.radius) {
        Object.assign(bubble, this.spawnBubble(this.height + bubble.radius));
      }
    }
    const current = this.theme?.current ?? { x: 0, y: 0 };
    for (const wisp of this.wisps) {
      wisp.x = wrap(
        wisp.x + (current.x * 0.5 + wisp.vx) * deltaTimeSec,
        this.width
      );
      wisp.y = wrap(
        wisp.y + (current.y * 0.5 + wisp.vy) * deltaTimeSec,
        this.height
      );
    }
  }

  /**
   * Draws the ambience over `view` of the arena onto a canvas of that size,
   * cleared first. Without `motion` - the player asked their system for
   * less - only the dish's depth is drawn, nothing that moves; the caller
   * may then skip frames on which nothing changed.
   */
  public paint(
    cx: CanvasRenderingContext2D,
    view: Rect,
    canvasWidth: number,
    canvasHeight: number,
    motion: boolean
  ): void {
    cx.clearRect(0, 0, canvasWidth, canvasHeight);
    const scale = canvasWidth / view.width;
    if (motion) {
      this.paintWisps(cx, view, scale);
      this.paintBubbles(cx, view, scale);
    }
    this.paintDepth(cx, view, scale, canvasWidth, canvasHeight);
  }

  /**
   * Each bubble in view, in arena cells: its centre as it sways, and its
   * radius.
   */
  public forEachBubble(
    view: Rect,
    visit: (x: number, y: number, radius: number) => void
  ): void {
    for (const bubble of this.bubbles) {
      const x = bubble.x + Math.sin(bubble.phase) * bubble.sway;
      const { y, radius } = bubble;
      if (
        x + radius > view.x &&
        y + radius > view.y &&
        x - radius < view.x + view.width &&
        y - radius < view.y + view.height
      ) {
        visit(x, y, radius);
      }
    }
  }

  /** Each wisp, in arena cells: its centre, radius and opacity. */
  public forEachWisp(
    visit: (x: number, y: number, radius: number, alpha: number) => void
  ): void {
    for (const wisp of this.wisps) {
      visit(wisp.x, wisp.y, wisp.radius, wisp.alpha);
    }
  }

  private spawnBubble(y: number): Bubble {
    const radius =
      AMBIENCE.bubbleRadiusMin + this.random() * AMBIENCE.bubbleRadiusVary;
    return {
      x: this.random() * this.width,
      y,
      radius,
      // Big bubbles rise faster.
      speed:
        AMBIENCE.bubbleSpeedMin +
        AMBIENCE.bubbleSpeedVary *
          ((radius - AMBIENCE.bubbleRadiusMin) / AMBIENCE.bubbleRadiusVary),
      sway: AMBIENCE.sway * (0.5 + this.random()),
      phase: this.random() * Math.PI * 2,
    };
  }

  private paintBubbles(
    cx: CanvasRenderingContext2D,
    view: Rect,
    scale: number
  ): void {
    // The bubbles in view, as canvas pixels: x, y and radius each.
    const seen = this.seen;
    let count = 0;
    this.forEachBubble(view, (x, y, radius) => {
      seen[count++] = (x - view.x) * scale;
      seen[count++] = (y - view.y) * scale;
      seen[count++] = radius * scale;
    });
    if (count === 0) {
      return;
    }
    // The film of every bubble in one go, then every rim, then every spot
    // of light - three strokes of the brush, not three per bubble.
    cx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    cx.beginPath();
    for (let i = 0; i < count; i += 3) {
      cx.moveTo(seen[i] + seen[i + 2], seen[i + 1]);
      cx.arc(seen[i], seen[i + 1], seen[i + 2], 0, Math.PI * 2);
    }
    cx.fill();
    cx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    cx.lineWidth = Math.max(1, scale * 0.18);
    cx.stroke();
    cx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    cx.beginPath();
    for (let i = 0; i < count; i += 3) {
      const r = seen[i + 2];
      const spot = r * 0.28;
      const sx = seen[i] - r * 0.38;
      const sy = seen[i + 1] - r * 0.4;
      cx.moveTo(sx + spot, sy);
      cx.arc(sx, sy, spot, 0, Math.PI * 2);
    }
    cx.fill();
  }

  private paintWisps(
    cx: CanvasRenderingContext2D,
    view: Rect,
    scale: number
  ): void {
    const sprite = this.sprite;
    if (sprite == null) {
      return;
    }
    for (const wisp of this.wisps) {
      const size = wisp.radius * 2 * scale;
      cx.globalAlpha = wisp.alpha;
      cx.drawImage(
        sprite,
        (wisp.x - wisp.radius - view.x) * scale,
        (wisp.y - wisp.radius - view.y) * scale,
        size,
        size
      );
    }
    cx.globalAlpha = 1;
  }

  /**
   * The depth of the dish: the shadow its rim throws over the floor along
   * each edge of the arena that is in view, and the sheen of the glass
   * from the top left. The rim's gradient is built once per scale, at the
   * origin, and moved to each edge; the sheen once per canvas size.
   */
  private paintDepth(
    cx: CanvasRenderingContext2D,
    view: Rect,
    scale: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const depth = this.depthBrushes(cx, scale, canvasWidth, canvasHeight);
    const { reach } = depth;
    const left = -view.x * scale;
    const top = -view.y * scale;
    const right = (this.width - view.x) * scale;
    const bottom = (this.height - view.y) * scale;
    // Each edge: where its strip starts, and which way its shadow fades.
    const edges: [number, number, CanvasGradient, number, number][] = [
      [left, 0, depth.rightwards, reach, canvasHeight],
      [right - reach, 0, depth.leftwards, reach, canvasHeight],
      [0, top, depth.downwards, canvasWidth, reach],
      [0, bottom - reach, depth.upwards, canvasWidth, reach],
    ];
    for (const [x, y, gradient, width, height] of edges) {
      cx.save();
      cx.translate(x, y);
      cx.fillStyle = gradient;
      cx.fillRect(0, 0, width, height);
      cx.restore();
    }
    cx.fillStyle = depth.sheen;
    cx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  /** The brushes of {@link paintDepth}, kept while the scale and the canvas stay. */
  private depthBrushes(
    cx: CanvasRenderingContext2D,
    scale: number,
    canvasWidth: number,
    canvasHeight: number
  ): DepthBrushes {
    const kept = this.depth;
    if (
      kept !== null &&
      kept.scale === scale &&
      kept.canvasWidth === canvasWidth &&
      kept.canvasHeight === canvasHeight
    ) {
      return kept;
    }
    const reach = AMBIENCE.rimWidth * Math.min(this.width, this.height) * scale;
    const shadow = (x0: number, y0: number, x1: number, y1: number) => {
      const gradient = cx.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${AMBIENCE.rimShade})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      return gradient;
    };
    const sheen = cx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    sheen.addColorStop(0, `rgba(255, 255, 255, ${AMBIENCE.sheen})`);
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    this.depth = {
      scale,
      canvasWidth,
      canvasHeight,
      reach,
      rightwards: shadow(0, 0, reach, 0),
      leftwards: shadow(reach, 0, 0, 0),
      downwards: shadow(0, 0, 0, reach),
      upwards: shadow(0, reach, 0, 0),
      sheen,
    };
    return this.depth;
  }

  /** A soft cloud in the mist's colour, drawn once and stamped per wisp. */
  private paintSprite(mist: Rgb): HTMLCanvasElement | null {
    const canvas = createCanvas(WISP_SPRITE, WISP_SPRITE);
    const cx = canvas?.getContext?.('2d');
    if (canvas == null || cx == null) {
      return null;
    }
    const half = WISP_SPRITE / 2;
    const gradient = cx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, rgba(mist, 1));
    gradient.addColorStop(0.5, rgba(mist, 0.35));
    gradient.addColorStop(1, rgba(mist, 0));
    cx.fillStyle = gradient;
    cx.fillRect(0, 0, WISP_SPRITE, WISP_SPRITE);
    return canvas;
  }
}
