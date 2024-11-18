import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HeadlineAnimationService {
  readonly runAnimation = signal(true);

  stopAnimation() {
    this.updateAnimation(false);
  }

  startAnimation() {
    this.updateAnimation(true);
  }

  toggleAnimation() {
    this.updateAnimation((prev) => !prev);
  }

  updateAnimation(animate: boolean): void;
  updateAnimation(updateFn: (prev: boolean) => boolean): void;
  updateAnimation(
    updateFnOrAnimate: boolean | ((prev: boolean) => boolean)
  ): void {
    if (typeof updateFnOrAnimate === 'boolean') {
      this.runAnimation.set(updateFnOrAnimate);
      return;
    }
    this.runAnimation.update(updateFnOrAnimate);
  }
}
