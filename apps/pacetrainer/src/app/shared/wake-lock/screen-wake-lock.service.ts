import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { TrainingRunnerService } from '../training-runner/training-runner.service';

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
  private readonly runnerService = inject(TrainingRunnerService);
  private sentinel: WakeLockSentinel | null = null;
  private pendingRequest: Promise<void> | null = null;
  private requestAgain = false;

  constructor() {
    effect(() => {
      if (this.runnerService.trainingState() === 'running') {
        void this.request();
      } else {
        void this.release();
      }
    });

    const onVisibilityChange = (): void => {
      if (
        this.document.visibilityState === 'visible' &&
        this.runnerService.trainingState() === 'running'
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
    if (this.pendingRequest) {
      // one lock at a time: a second one would never be released. The
      // pending one may still come back released (page hidden meanwhile),
      // so check again once it settles.
      this.requestAgain = true;
      return;
    }
    this.pendingRequest = this.acquire(wakeLock).finally(() => {
      this.pendingRequest = null;
    });
    await this.pendingRequest;
    if (this.requestAgain) {
      this.requestAgain = false;
      if (this.runnerService.trainingState() === 'running') {
        await this.request();
      }
    }
  }

  private async acquire(wakeLock: WakeLock): Promise<void> {
    try {
      this.sentinel = await wakeLock.request('screen');
      if (this.runnerService.trainingState() !== 'running') {
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
