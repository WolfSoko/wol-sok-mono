import { ArenaFrame, ArenaPainter, boostRingRadius } from './arena-painter';
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

  public constructor(
    private readonly cx: CanvasRenderingContext2D,
    private readonly width: number,
    private readonly height: number,
    scale: number
  ) {
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

  public paint(frame: ArenaFrame): void {
    const cx = this.cx;
    // Lay the floor over the previous frame, so movement leaves a short trail.
    this.arena.drawFloor(cx, frame.clear);
    this.arena.drawMotes(cx, frame.deltaTimeSec);
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

    drawJam(cx, frame.nutrients, frame.balance.nutrientEnergy, frame.timeSec);
    this.drawCursors(frame);
  }

  /**
   * Draws each player's crosshair in their own colour, with a ring around it
   * while the player's boost is running.
   */
  private drawCursors(frame: ArenaFrame): void {
    const cx = this.cx;
    for (const cursor of frame.cursors) {
      const css = `rgba(${cursor.color.join(',')})`;
      cx.fillStyle = css;
      cx.fillRect(cursor.x - 6, cursor.y - 0.5, 13, 2);
      cx.fillRect(cursor.x - 0.5, cursor.y - 6, 2, 13);

      if (cursor.boostLeft != null) {
        cx.strokeStyle = css;
        cx.lineWidth = 1.5;
        cx.beginPath();
        cx.arc(
          cursor.x,
          cursor.y,
          boostRingRadius(cursor.boostLeft),
          0,
          Math.PI * 2
        );
        cx.stroke();
      }
    }
  }
}
