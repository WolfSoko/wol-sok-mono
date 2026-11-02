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
    } else if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => findToolbarAndObserve(observer));
    } else {
      window.setTimeout(() => findToolbarAndObserve(observer), 200);
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

  effect(() => {
    if (isVisible()) {
      headlineAnimationService.startAnimation();
    } else {
      headlineAnimationService.stopAnimation();
    }
  });
}
