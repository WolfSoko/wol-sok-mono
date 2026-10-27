import {
  afterNextRender,
  ErrorHandler,
  inject,
  Injectable,
  Injector,
  PendingTasks,
  signal,
} from '@angular/core';

/**
 * The stage's busy indicator, for the taps that set heavy work off: a mode
 * picked (the level map lays out its cards), a level picked (the arena is
 * built for it), a match started. Such work takes the main thread for a
 * moment, on a slow phone for most of a second, and the browser paints
 * nothing meanwhile - the tap seemed to do nothing.
 *
 * {@link run} therefore shows the indicator first, lets the browser paint
 * it and only then does the work. The spinner turns on the compositor, so
 * it keeps turning while the work blocks the page.
 */
@Injectable({ providedIn: 'root' })
export class StageBusy {
  private readonly injector = inject(Injector);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly working = signal(false);

  /** True from the tap until the work it set off is done. */
  public readonly active = this.working.asReadonly();

  /**
   * Runs `work` once the indicator is on the screen, and takes the
   * indicator away with what the work rendered. A tap while the stage is
   * busy is dropped: a second Start must not start twice.
   */
  public run(work: () => void | Promise<unknown>): void {
    if (this.working()) {
      return;
    }
    this.working.set(true);
    // Keeps the app unstable meanwhile, so tests wait for the work.
    const done = this.pendingTasks.add();
    afterNextRender(
      () =>
        afterPaint(async () => {
          try {
            await work();
          } catch (error) {
            this.errorHandler.handleError(error);
          } finally {
            this.working.set(false);
            done();
          }
        }),
      { injector: this.injector }
    );
  }
}

/** Calls `next` once the browser painted its coming frame. */
function afterPaint(next: () => void): void {
  // A frame's callbacks run before its paint, a task they queue after it.
  requestAnimationFrame(() => setTimeout(next));
}
