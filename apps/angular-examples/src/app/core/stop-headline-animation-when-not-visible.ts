import { effect, signal } from '@angular/core';
import { HeadlineAnimationService } from '@wolsok/headline-animation';

export function stopHeadlineAnimationWhenNotVisible(
  headlineAnimationService: HeadlineAnimationService
): void {
  const isVisible = signal(false);

  function findToolbarAndObserve(observer: IntersectionObserver): void {
    const mainToolbarElem = document.getElementById('main-toolbar');
    if (mainToolbarElem) {
      observer.observe(mainToolbarElem);
    } else {
      requestIdleCallback(() => findToolbarAndObserve(observer));
    }
  }

  const intersectionCallback: IntersectionObserverCallback = (
    entries: IntersectionObserverEntry[]
  ) => {
    entries.forEach((entry) => {
      isVisible.set(entry.isIntersecting);
    });
  };
  const observer = new IntersectionObserver(intersectionCallback);

  findToolbarAndObserve(observer);

  effect(
    () => {
      if (isVisible()) {
        console.log('Visible Start animation');
        headlineAnimationService.startAnimation();
      } else {
        console.log('Not Visible Stop Animation');
        headlineAnimationService.stopAnimation();
      }
    },
    { allowSignalWrites: true }
  );
}
