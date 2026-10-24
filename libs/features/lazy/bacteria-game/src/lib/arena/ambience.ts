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
  private current = { x: 0, y: 0 };
  private mist: Rgb = [255, 255, 255];
  private sprite: HTMLCanvasElement | null = null;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly random: () => number = Math.random
  ) {
    this.reset();
  }

  /** Follows another level's look: its current and the colour of its mist. */
  public setTheme(theme: ArenaTheme): void {
    this.current = theme.current;
    this.mist = theme.motes;
    this.sprite = this.paintSprite();
  }

  /** Scatters a fresh set of bubbles and wisps. */
  public reset(): void {
    const count = Math.round(
      this.width * this.height * AMBIENCE.bubblesPerCell
    );
    this.bubbles = Array.from({ length: count }, () =>
      this.spawnBubble(this.random() * this.height)
    );
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
    for (const wisp of this.wisps) {
      wisp.x = wrap(
        wisp.x + (this.current.x * 0.5 + wisp.vx) * deltaTimeSec,
        this.width
      );
      wisp.y = wrap(
        wisp.y + (this.current.y * 0.5 + wisp.vy) * deltaTimeSec,
        this.height
      );
    }
  }

  /** The bubbles as they are right now - for the tests. */
  public bubblesNow(): readonly { x: number; y: number; radius: number }[] {
    return this.bubbles.map(({ x, y, radius }) => ({ x, y, radius }));
  }

  /**
   * Draws the ambience over `view` of the arena onto a canvas of that size,
   * cleared first. Without `motion` - the player asked their system for
   * less - only the dish's depth is drawn, nothing that moves.
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
    const seen = this.bubbles
      .map((bubble) => ({
        x: (bubble.x + Math.sin(bubble.phase) * bubble.sway - view.x) * scale,
        y: (bubble.y - view.y) * scale,
        r: bubble.radius * scale,
      }))
      .filter(
        ({ x, y, r }) =>
          x + r > 0 &&
          y + r > 0 &&
          x - r < view.width * scale &&
          y - r < view.height * scale
      );
    if (seen.length === 0) {
      return;
    }
    // The film of every bubble in one go, then every rim, then every spot
    // of light - three strokes of the brush, not three per bubble.
    cx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    cx.beginPath();
    for (const { x, y, r } of seen) {
      cx.moveTo(x + r, y);
      cx.arc(x, y, r, 0, Math.PI * 2);
    }
    cx.fill();
    cx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    cx.lineWidth = Math.max(1, scale * 0.18);
    cx.stroke();
    cx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    cx.beginPath();
    for (const { x, y, r } of seen) {
      const spot = r * 0.28;
      const sx = x - r * 0.38;
      const sy = y - r * 0.4;
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
   * from the top left.
   */
  private paintDepth(
    cx: CanvasRenderingContext2D,
    view: Rect,
    scale: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const reach = AMBIENCE.rimWidth * Math.min(this.width, this.height) * scale;
    const shade = `rgba(0, 0, 0, ${AMBIENCE.rimShade})`;
    const clear = 'rgba(0, 0, 0, 0)';
    const left = -view.x * scale;
    const top = -view.y * scale;
    const right = (this.width - view.x) * scale;
    const bottom = (this.height - view.y) * scale;
    // Each edge: where the shadow starts and where it has faded, and the
    // strip it covers.
    const edges: {
      from: [number, number];
      to: [number, number];
      strip: [number, number, number, number];
    }[] = [
      {
        from: [left, 0],
        to: [left + reach, 0],
        strip: [left, 0, reach, canvasHeight],
      },
      {
        from: [right, 0],
        to: [right - reach, 0],
        strip: [right - reach, 0, reach, canvasHeight],
      },
      {
        from: [0, top],
        to: [0, top + reach],
        strip: [0, top, canvasWidth, reach],
      },
      {
        from: [0, bottom],
        to: [0, bottom - reach],
        strip: [0, bottom - reach, canvasWidth, reach],
      },
    ];
    for (const { from, to, strip } of edges) {
      const gradient = cx.createLinearGradient(from[0], from[1], to[0], to[1]);
      gradient.addColorStop(0, shade);
      gradient.addColorStop(1, clear);
      cx.fillStyle = gradient;
      cx.fillRect(...strip);
    }
    const sheen = cx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    sheen.addColorStop(0, `rgba(255, 255, 255, ${AMBIENCE.sheen})`);
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    cx.fillStyle = sheen;
    cx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  /** A soft cloud in the mist's colour, drawn once and stamped per wisp. */
  private paintSprite(): HTMLCanvasElement | null {
    const canvas = createCanvas(WISP_SPRITE, WISP_SPRITE);
    const cx = canvas?.getContext?.('2d');
    if (canvas == null || cx == null) {
      return null;
    }
    const half = WISP_SPRITE / 2;
    const gradient = cx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, rgba(this.mist, 1));
    gradient.addColorStop(0.5, rgba(this.mist, 0.35));
    gradient.addColorStop(1, rgba(this.mist, 0));
    cx.fillStyle = gradient;
    cx.fillRect(0, 0, WISP_SPRITE, WISP_SPRITE);
    return canvas;
  }
}
