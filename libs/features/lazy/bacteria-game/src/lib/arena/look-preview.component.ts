import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { prefersReducedMotion } from '../reduced-motion';
import { BacteriaLook } from '../settings.service';
import { LOOKS } from './colony-renderer';
import { paintLookPreview, PreviewSize, SKIN_PREVIEW } from './look-preview';

/** How many canvas pixels a cell of the preview gets - two per layer pixel. */
const PIXELS_PER_CELL = 4;
/** How often a look that moves is drawn again, in ms - plenty for drifting snippets. */
const FRAME_MS = 66;

/**
 * A look on a sample colony in a colour, drawn by the game's own painter -
 * the skin tiles of the My Colony screen, and the player's colony at its
 * top. A look that moves, like the bubbles, keeps moving where `animate`
 * asks for it and the system does not ask for less motion.
 */
@Component({
  selector: 'feat-lazy-bac-game-look-preview',
  template: `<canvas
    #canvas
    role="img"
    [attr.aria-label]="label()"
    [width]="size().width * pixelsPerCell"
    [height]="size().height * pixelsPerCell"
  ></canvas>`,
  styles: `
    :host {
      display: block;
    }
    canvas {
      display: block;
      width: 100%;
      height: auto;
      border-radius: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LookPreviewComponent {
  public readonly look = input.required<BacteriaLook>();
  /** The colony's colour, RGB from 0 to 255. */
  public readonly color = input.required<readonly number[]>();
  public readonly size = input<PreviewSize>(SKIN_PREVIEW);
  public readonly animate = input(false);
  /** What the picture shows, for a reader - empty where a caption says it. */
  public readonly label = input('');

  protected readonly pixelsPerCell = PIXELS_PER_CELL;
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly reducedMotion = prefersReducedMotion();

  constructor() {
    afterRenderEffect((onCleanup) => {
      const look = this.look();
      const color = this.color();
      const size = this.size();
      const moving =
        this.animate() && LOOKS[look].animated && !this.reducedMotion();
      const cx = this.canvas().nativeElement.getContext('2d');
      if (cx == null) {
        return;
      }
      const start = performance.now();
      const draw = () =>
        paintLookPreview(
          cx,
          look,
          color,
          size,
          (performance.now() - start) / 1000
        );
      draw();
      if (moving) {
        const handle = setInterval(draw, FRAME_MS);
        onCleanup(() => clearInterval(handle));
      }
    });
  }
}
