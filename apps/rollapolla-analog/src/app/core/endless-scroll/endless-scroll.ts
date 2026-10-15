import { effect, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** How many more items each step of the endless scroll asks for. */
export const ENDLESS_SCROLL_PAGE_SIZE = 20;

/**
 * Endless scroll over a live query: while the end of the list is in view and
 * the last answer said there is more, the query is asked for one page more.
 * Create it in an injection context.
 *
 * The query listens to {@link counts} (switching to the new count, so the
 * previous answer stays until the next one arrives) and reports every
 * answer through {@link answered}.
 */
export class EndlessScroll {
  /** The last answer said the query could return more. */
  public readonly hasMore = signal(false);
  private readonly count = new BehaviorSubject(ENDLESS_SCROLL_PAGE_SIZE);
  /** How many items the query should return: grows page by page. */
  public readonly counts: Observable<number> = this.count.asObservable();
  private readonly endInView = signal(false);
  /** A count was asked for and its answer has not arrived yet. */
  private readonly waiting = signal(true);

  constructor() {
    effect(() => {
      if (this.endInView() && this.hasMore() && !this.waiting()) {
        // runs again after the answer while the end stays in view, e.g.
        // while a search filters out most of the polls loaded so far
        this.waiting.set(true);
        this.count.next(this.count.value + ENDLESS_SCROLL_PAGE_SIZE);
      }
    });
  }

  /** The query answered for the latest count. */
  public answered(hasMore: boolean): void {
    this.hasMore.set(hasMore);
    this.waiting.set(false);
  }

  /** Back to the first page, e.g. for another order. */
  public restart(): void {
    this.hasMore.set(false);
    this.waiting.set(true);
    this.count.next(ENDLESS_SCROLL_PAGE_SIZE);
  }

  /** Called by `rap-endless-scroll-end` after the list. */
  public setEndInView(inView: boolean): void {
    this.endInView.set(inView);
  }
}
