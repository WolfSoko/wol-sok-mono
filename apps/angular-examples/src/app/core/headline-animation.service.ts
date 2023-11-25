import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, Subscriber } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class HeadlineAnimationService {
  private _runAnimation$ = new BehaviorSubject<boolean>(true);
  readonly runAnimation$: Observable<boolean>;

  constructor() {
    const isVisible$ = new Observable<boolean>((subscriber) => {
      function findToolbarAndObserve(
        observer: IntersectionObserver,
        subscriber: Subscriber<boolean>
      ): void {
        const mainToolbarElem = document.getElementById('main-toolbar');
        if (mainToolbarElem) {
          observer.observe(mainToolbarElem);
        } else {
          requestIdleCallback(() =>
            findToolbarAndObserve(observer, subscriber)
          );
        }
      }

      const intersectionCallback: IntersectionObserverCallback = (
        entries: IntersectionObserverEntry[]
      ) => {
        entries.forEach((entry) => {
          subscriber.next(entry.isIntersecting);
        });
      };
      const observer = new IntersectionObserver(intersectionCallback);

      findToolbarAndObserve(observer, subscriber);
      return () => {
        observer.disconnect();
      };
    });

    this.runAnimation$ = combineLatest([
      this._runAnimation$.asObservable(),
      isVisible$,
    ]).pipe(
      map(([animate, isVisible]) => animate && isVisible),
      distinctUntilChanged()
    );
  }

  stopAnimation() {
    this._runAnimation$.next(false);
  }

  startAnimation() {
    this._runAnimation$.next(true);
  }

  runWithoutAnimations<T>(runnable: () => T): T {
    this.stopAnimation();
    const result = runnable();
    this.startAnimation();
    return result;
  }
}
