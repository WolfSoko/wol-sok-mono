import { computed, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, retry, tap, timer } from 'rxjs';
import { Page } from '../../../shared/admin';
import { EndlessScroll } from '../endless-scroll/endless-scroll';

/** How long to wait before listening again after loading failed. */
const RETRY_DELAY_MS = 10_000;

export type EndlessItems<T> = {
  /** `undefined` while the first page loads. */
  items: Signal<T[] | undefined>;
  /** Stays set until a page loads again. */
  failed: Signal<boolean>;
};

/**
 * The items of a paged live query, reporting each answer to `scroll` and
 * listening again a while after it failed. Call in an injection context.
 */
export function endlessItems<T>(
  scroll: EndlessScroll,
  pages: Observable<Page<T>>,
  failure: string
): EndlessItems<T> {
  const failed = signal(false);
  const page = toSignal(
    pages.pipe(
      tap(({ hasMore }) => {
        failed.set(false);
        scroll.answered(hasMore);
      }),
      retry({
        delay: (error: unknown) => {
          console.error(failure, error);
          failed.set(true);
          return timer(RETRY_DELAY_MS);
        },
      })
    )
  );
  return {
    items: computed(() => page()?.items),
    failed: failed.asReadonly(),
  };
}
