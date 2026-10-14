import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { TrainingRun } from '../training-run/training-run';

/**
 * Keeps the screen on while a training is running. Without it phones dim and
 * lock mid-run, and the browser throttles the training timers.
 *
 * The browser drops the lock whenever the page is hidden, so it is requested
 * again when the page becomes visible during a running training.
 */
@Injectable({ providedIn: 'root' })
export class ScreenWakeLockService {
  private readonly document = inject(DOCUMENT);
  private readonly trainingRun = inject(TrainingRun);
  private sentinel: WakeLockSentinel | null = null;

  constructor() {
    effect(() => {
      if (this.trainingRun.phase() === 'running') {
        void this.request();
      } else {
        void this.release();
      }
    });

    const onVisibilityChange = (): void => {
      if (
        this.document.visibilityState === 'visible' &&
        this.trainingRun.phase() === 'running'
      ) {
        void this.request();
      }
    };
    this.document.addEventListener('visibilitychange', onVisibilityChange);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisibilityChange);
      void this.release();
    });
  }

  private async request(): Promise<void> {
    const wakeLock = this.document.defaultView?.navigator.wakeLock;
    if (!wakeLock || (this.sentinel && !this.sentinel.released)) {
      return;
    }
    try {
      this.sentinel = await wakeLock.request('screen');
      if (this.trainingRun.phase() !== 'running') {
        // paused or stopped while the request was pending
        await this.release();
      }
    } catch (e) {
      // e.g. denied by battery saver or permissions policy; training still works
      console.warn('Screen wake lock not available: ', e);
    }
  }

  private async release(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    await sentinel?.release();
  }
}
