import { wrap } from '../state/geometry';
import { ArenaTheme } from './arena-theme';

/** A speck drifting over the floor. */
interface Mote {
  x: number;
  y: number;
  /** Its own drift on top of the theme's current. */
  vx: number;
  vy: number;
  /** Where in its twinkle it is, in radians. */
  phase: number;
}

/**
 * The specks drifting over the floor of an arena, carried along by the
 * theme's current and twinkling as they go. Shared by both painters, so the
 * WebGL and the canvas arena look the same.
 */
export class Motes {
  private motes: Mote[] = [];
  private theme: ArenaTheme | null = null;
  /** Seconds the specks have drifted - also the clock of the gate blinking. */
  public timeSec = 0;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly random: () => number = Math.random
  ) {}

  /** Scatters a fresh set of specks for another level. */
  public reset(theme: ArenaTheme): void {
    this.theme = theme;
    this.motes = Array.from({ length: theme.moteCount }, () => ({
      x: this.random() * this.width,
      y: this.random() * this.height,
      vx: (this.random() - 0.5) * 3,
      vy: (this.random() - 0.5) * 3,
      phase: this.random() * Math.PI * 2,
    }));
  }

  /** Lets the specks drift on by one frame. */
  public advance(deltaTimeSec: number): void {
    const theme = this.theme;
    if (theme == null) {
      return;
    }
    this.timeSec += deltaTimeSec;
    for (const mote of this.motes) {
      mote.x = wrap(
        mote.x + (theme.current.x + mote.vx) * deltaTimeSec,
        this.width
      );
      mote.y = wrap(
        mote.y + (theme.current.y + mote.vy) * deltaTimeSec,
        this.height
      );
    }
  }

  /** Each speck's cell and how bright it twinkles right now, 0 to 1. */
  public forEach(draw: (x: number, y: number, alpha: number) => void): void {
    for (const mote of this.motes) {
      const twinkle = 0.5 + 0.5 * Math.sin(this.timeSec * 1.7 + mote.phase);
      draw(Math.floor(mote.x), Math.floor(mote.y), 0.12 + 0.3 * twinkle);
    }
  }
}
