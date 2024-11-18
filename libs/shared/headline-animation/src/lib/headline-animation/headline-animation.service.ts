import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HeadlineAnimationService {
  private _runAnimation = signal<boolean>(true);
  readonly runAnimation = this._runAnimation.asReadonly();

  stopAnimation() {
    this._runAnimation.set(false);
  }

  startAnimation() {
    this._runAnimation.set(true);
  }
}
