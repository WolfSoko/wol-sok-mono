import { Zone } from '@wolsok/feat-shared-bacteria-engine';
import { ArenaFrame, ArenaPainter } from './arena-painter';
import { ArenaRenderer } from './arena-renderer';
import { ArenaTheme } from './arena-theme';
import { drawCursors } from './canvas-cursors';
import { ColonyRenderer } from './colony-renderer';
import { drawJam } from './jam';
import { WeaponFx } from './weapon-fx';

/**
 * The arena drawn with the Canvas 2D API - the fallback for browsers
 * without WebGL2. The colonies are computed on the CPU here, which is
 * fine for the pixel look but heavy for the slime.
 */
export class CanvasArenaPainter implements ArenaPainter {
  public readonly kind = 'canvas';
  private readonly arena: ArenaRenderer;
  private readonly colonies: ColonyRenderer;
  /** The weapons going off and acting. */
  private readonly weapons: WeaponFx;
  /** Cells per base cell - the jam and the crosshairs are as big on every grid. */
  private readonly unit: number;

  public constructor(
    private readonly cx: CanvasRenderingContext2D,
    private readonly width: number,
    private readonly height: number,
    /** Pixels per cell the zones are painted with. */
    detail: number,
    unit: number
  ) {
    this.unit = unit;
    this.arena = new ArenaRenderer(width, height, Math.random, detail, unit);
    this.weapons = new WeaponFx(unit);
    this.colonies = new ColonyRenderer(width, height, unit);
    cx.imageSmoothingEnabled = false;
  }

  public dispose(): void {
    // Nothing but the context, which goes with its canvas.
  }

  public setFloor(theme: ArenaTheme, zones: readonly Zone[]): void {
    this.arena.setFloor(theme, zones);
  }

  public showLastFrame(): void {
    // A 2D canvas keeps what was drawn on it.
  }

  public paint(frame: ArenaFrame): void {
    const cx = this.cx;
    // Everything is drawn in arena cells; the transform shows the view.
    const { view } = frame;
    const scale = cx.canvas.width / view.width;
    cx.setTransform(scale, 0, 0, scale, -view.x * scale, -view.y * scale);
    // Lay the floor over the previous frame, so movement leaves a short trail.
    this.arena.drawFloor(cx, frame.clear);
    this.arena.drawMotes(cx, frame.deltaTimeSec);
    this.arena.drawWalls(cx, frame.walls);
    this.arena.drawDynamicWalls(cx, frame.dynamicWalls);
    this.weapons.update(frame);
    this.arena.drawWeaponMarks(cx, this.weapons.ground, false);

    const layers = this.colonies.render(
      frame.colonies,
      frame.balance,
      frame.timeSec,
      view
    );
    for (const layer of layers) {
      this.arena.tintColonies(layer.canvas, this.weapons.tints);
      // A layer drawn from the density is scaled up smoothly, the pixel
      // layer stays crisp.
      cx.imageSmoothingEnabled = layer.smooth;
      cx.drawImage(layer.canvas, 0, 0, this.width, this.height);
    }
    cx.imageSmoothingEnabled = false;
    // The weapons over the colonies, then their light - under the jam and
    // the crosshairs, which stay readable.
    this.arena.drawWeaponMarks(cx, this.weapons.over, false);
    this.arena.drawWeaponMarks(cx, this.weapons.light, true);

    drawJam(
      cx,
      frame.nutrients,
      frame.balance.nutrientEnergy,
      frame.timeSec,
      this.unit
    );
    drawCursors(cx, frame.cursors, this.unit);
  }
}
