import {
  ArenaFrame,
  ArenaPainter,
  boostRingRadius,
  crosshairBars,
} from './arena-painter';
import { scaleOf } from '../state/arena-size';
import { ArenaRenderer } from './arena-renderer';
import { ArenaTheme } from './arena-theme';
import { ColonyRenderer, drawJam } from './colony-renderer';

/**
 * The arena drawn with the Canvas 2D API - the fallback for browsers
 * without WebGL2. The colonies are computed on the CPU here, which is
 * fine for the pixel look but heavy for the slime.
 */
export class CanvasArenaPainter implements ArenaPainter {
  public readonly kind = 'canvas';
  private readonly arena: ArenaRenderer;
  private readonly colonies: ColonyRenderer;
  /** Cells per base cell - the jam and the crosshairs are as big on every grid. */
  private readonly unit: number;

  public constructor(
    private readonly cx: CanvasRenderingContext2D,
    private readonly width: number,
    private readonly height: number,
    scale: number
  ) {
    this.unit = scaleOf(width);
    this.arena = new ArenaRenderer(width, height);
    this.colonies = new ColonyRenderer(width, height);
    // Everything is drawn in arena cells; the transform scales it up.
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    cx.imageSmoothingEnabled = false;
  }

  public dispose(): void {
    // Nothing but the context, which goes with its canvas.
  }

  public setTheme(theme: ArenaTheme): void {
    this.arena.setTheme(theme);
  }

  public showLastFrame(): void {
    // A 2D canvas keeps what was drawn on it.
  }

  public paint(frame: ArenaFrame): void {
    const cx = this.cx;
    // Lay the floor over the previous frame, so movement leaves a short trail.
    this.arena.drawFloor(cx, frame.clear);
    this.arena.drawMotes(cx, frame.deltaTimeSec);
    this.arena.drawZones(cx, frame.zones);
    this.arena.drawWalls(cx, frame.walls);
    this.arena.drawDynamicWalls(cx, frame.dynamicWalls);

    const layer = this.colonies.render(
      frame.colonies,
      frame.balance,
      frame.look,
      frame.timeSec
    );
    if (layer != null) {
      // The slime layer is scaled up smoothly, the pixel layer stays crisp.
      cx.imageSmoothingEnabled = frame.look === 'slime';
      cx.drawImage(layer, 0, 0, this.width, this.height);
      cx.imageSmoothingEnabled = false;
    }

    drawJam(
      cx,
      frame.nutrients,
      frame.balance.nutrientEnergy,
      frame.timeSec,
      this.unit
    );
    this.drawCursors(frame);
  }

  /**
   * Draws each player's crosshair in their own colour, with a ring around it
   * while the player's boost is running.
   */
  private drawCursors(frame: ArenaFrame): void {
    const cx = this.cx;
    // As big on every grid.
    for (const cursor of frame.cursors) {
      const css = `rgba(${cursor.color.join(',')})`;
      cx.fillStyle = css;
      for (const bar of crosshairBars(cursor, this.unit)) {
        cx.fillRect(bar.x, bar.y, bar.width, bar.height);
      }

      if (cursor.boostLeft != null) {
        cx.strokeStyle = css;
        cx.lineWidth = 1.5 * this.unit;
        cx.beginPath();
        cx.arc(
          cursor.x,
          cursor.y,
          boostRingRadius(cursor.boostLeft) * this.unit,
          0,
          Math.PI * 2
        );
        cx.stroke();
      }
    }
  }
}
