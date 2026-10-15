import { effect, signal } from '@angular/core';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';

/** How many more items each step of the endless scroll asks for. */
export const ENDLESS_SCROLL_PAGE_SIZE = 20;

/**
 * Endless scroll over a live query: while the end of the list is in view and
 * the last answer said there is more, the query is repeated for one page
 * more. Create it in an injection context.
 */
export class EndlessScroll {
  /** The last answer said the query could return more. */
  public readonly hasMore = signal(false);
  private readonly count = new BehaviorSubject(ENDLESS_SCROLL_PAGE_SIZE);
  private readonly endInView = signal(false);
  /** The count the last answer was for: one step at a time. */
  private readonly answeredCount = signal(0);

  constructor() {
    effect(() => {
      if (
        this.endInView() &&
        this.hasMore() &&
        this.answeredCount() === this.count.value
      ) {
        // runs again after the answer while the end stays in view, e.g.
        // while a search filters out most of the polls loaded so far
        this.count.next(this.count.value + ENDLESS_SCROLL_PAGE_SIZE);
      }
    });
  }

  /**
   * Starts over at the first page and runs `load` for it, then again for
   * each further page. Keeps emitting the previous answer until the next
   * one arrives.
   */
  public load<T>(
    load: (count: number) => Observable<T>,
    hasMore: (answer: T) => boolean
  ): Observable<T> {
    this.count.next(ENDLESS_SCROLL_PAGE_SIZE);
    return this.count.pipe(
      switchMap((count) =>
        load(count).pipe(
          tap((answer) => {
            this.hasMore.set(hasMore(answer));
            this.answeredCount.set(count);
          })
        )
      )
    );
  }

  /** Called by `rap-endless-scroll-end` after the list. */
  public setEndInView(inView: boolean): void {
    this.endInView.set(inView);
  }
}
