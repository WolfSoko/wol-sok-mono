import type { ArenaFrame, ArenaPainter } from '../lib/arena/arena-painter';
import { ARENA_PAINTER_FACTORY } from '../lib/arena/arena-view.component';

/** A painter that keeps what it was asked to paint - jsdom draws nothing. */
export class RecordingPainter implements ArenaPainter {
  public readonly kind = 'canvas';
  public readonly frames: ArenaFrame[] = [];
  public disposed = false;

  public setFloor(): void {
    // Nothing to lay: jsdom has no canvas.
  }

  public paint(frame: ArenaFrame): void {
    this.frames.push(frame);
  }

  public showLastFrame(): void {
    // Nothing shown: jsdom has no canvas.
  }

  public dispose(): void {
    this.disposed = true;
  }
}

/** Provides arena views with recording painters, kept in `painters`. */
export function recordingPainters(painters: RecordingPainter[] = []) {
  return {
    provide: ARENA_PAINTER_FACTORY,
    useValue: () => {
      const painter = new RecordingPainter();
      painters.push(painter);
      return painter;
    },
  };
}
